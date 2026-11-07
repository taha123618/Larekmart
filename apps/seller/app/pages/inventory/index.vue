<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import { useNotifications } from "~/composables/useNotifications";
import type { InventoryStock } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import BulkImportModal from "~/components/ui/BulkImportModal.vue";
import { exportToCsv, type CsvColumn } from "~/utils/export";
import type { ValidationRule } from "~/utils/csv-parser";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const notify = useNotifications();

const inventoryItems = ref<InventoryStock[]>([]);
const isLoading = ref(true);
const isImportModalOpen = ref(false);
const isSubmittingAdjustment = ref(false);

const inventoryImportRules: ValidationRule<any>[] = [
  { field: "sku", required: true },
  {
    field: "availableStock",
    required: true,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 ? null : "Available stock must be a non-negative integer";
    },
    transform: (val) => Math.round(Number(val)),
  },
  {
    field: "reorderPoint",
    required: false,
    validate: (val) => {
      if (!val) return null;
      const num = Number(val);
      return !isNaN(num) && num >= 0 ? null : "Reorder point must be a positive integer";
    },
    transform: (val) => (val ? Math.round(Number(val)) : 10),
  },
  {
    field: "safetyStock",
    required: false,
    validate: (val) => {
      if (!val) return null;
      const num = Number(val);
      return !isNaN(num) && num >= 0 ? null : "Safety stock must be a positive integer";
    },
    transform: (val) => (val ? Math.round(Number(val)) : 5),
  },
  { field: "warehouse", required: false },
];

const sampleInventoryRows = [
  {
    sku: "SKU-ANC-001",
    availableStock: 150,
    reorderPoint: 20,
    safetyStock: 10,
    warehouse: "Fulfillment Hub Karachi",
  },
  {
    sku: "SKU-GAN-100",
    availableStock: 85,
    reorderPoint: 15,
    safetyStock: 5,
    warehouse: "Logistics Center Lahore",
  },
];

const inventoryTemplateHeaders = [
  { key: "sku", label: "sku" },
  { key: "availableStock", label: "availableStock" },
  { key: "reorderPoint", label: "reorderPoint" },
  { key: "safetyStock", label: "safetyStock" },
  { key: "warehouse", label: "warehouse" },
];

const handleExportInventory = () => {
  const columns: CsvColumn<InventoryStock>[] = [
    { key: "sku", label: "SKU" },
    { key: "productName", label: "Product Title" },
    { key: "availableStock", label: "Available Stock" },
    { key: "reservedStock", label: "Reserved Stock" },
    { key: "reorderPoint", label: "Reorder Threshold" },
    { key: "status", label: "Status" },
  ];
  exportToCsv("seller_inventory_ledger", columns, inventoryItems.value);
};

const handleInventoryAdjustmentSubmit = async (importedItems: any[]) => {
  isSubmittingAdjustment.value = true;
  try {
    let successCount = 0;
    for (const item of importedItems) {
      try {
        await api.post("/api/v1/inventory/adjust", {
          sku: item.sku,
          quantity: item.availableStock,
          reorderPoint: item.reorderPoint,
          safetyStock: item.safetyStock,
          warehouse: item.warehouse || "Default",
        });
        successCount++;
      } catch {
        // Continue
      }
    }

    notify.success("Stock Adjustments Applied", `Updated stock thresholds and inventory levels for ${successCount} items.`);
    isImportModalOpen.value = false;
    await fetchInventory();
  } catch (err: any) {
    notify.error("Stock Adjustment Failed", err?.message || "Failed to apply bulk inventory changes.");
  } finally {
    isSubmittingAdjustment.value = false;
  }
};

const fetchInventory = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<any>("/api/v1/inventory");
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];
    inventoryItems.value = rawList.map((item: any) => ({
      ...item,
      availableStock:
        item.availableStock ??
        Math.max(0, (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)),
      reservedStock: item.reservedStock ?? (item.quantityReserved ?? 0),
      safetyStock: item.safetyStock ?? 0,
      reorderPoint: item.reorderPoint ?? 10,
      productName:
        item.productName || item.product?.name || `Product #${item.productId}`,
      sku:
        item.sku ||
        `SKU-${item.productId?.slice?.(0, 8) || item.id?.slice?.(0, 8)}`,
      status:
        item.status ||
        ((item.quantityOnHand ?? 0) <= 0
          ? "OUT_OF_STOCK"
          : (item.quantityOnHand ?? 0) <= (item.reorderPoint ?? 10)
            ? "LOW_STOCK"
            : "IN_STOCK"),
    }));
  } catch {
    inventoryItems.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchInventory();
});

const totalUnits = computed(() => {
  return inventoryItems.value.reduce((acc, item) => acc + (item.availableStock || 0), 0);
});

const lowStockCount = computed(() => {
  return inventoryItems.value.filter((item) => item.availableStock > 0 && item.availableStock <= item.reorderPoint).length;
});

const outOfStockCount = computed(() => {
  return inventoryItems.value.filter((item) => (item.availableStock || 0) <= 0).length;
});

const columns: ColumnDef<InventoryStock, unknown>[] = [
  {
    accessorKey: "sku",
    header: "SKU / Code",
    cell: ({ row }) =>
      h("span", { class: "font-mono font-semibold text-xs text-slate-900 dark:text-white" }, row.original.sku),
  },
  {
    accessorKey: "productName",
    header: "Product Title",
    cell: ({ row }) =>
      h("span", { class: "font-medium text-xs text-slate-800 dark:text-slate-200" }, row.original.productName),
  },
  {
    accessorKey: "availableStock",
    header: "Available",
    cell: ({ row }) => {
      const stock = row.original.availableStock;
      const isLow = stock <= row.original.reorderPoint && stock > 0;
      const isOut = stock <= 0;
      return h(
        "span",
        {
          class: [
            "font-bold text-xs",
            isOut ? "text-rose-600 dark:text-rose-400" : isLow ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
          ],
        },
        `${stock} units`,
      );
    },
  },
  {
    accessorKey: "reservedStock",
    header: "Reserved (in orders)",
    cell: ({ row }) => h("span", { class: "text-xs text-slate-500" }, `${row.original.reservedStock || 0} units`),
  },
  {
    accessorKey: "reorderPoint",
    header: "Reorder Alert Point",
    cell: ({ row }) => h("span", { class: "text-xs font-mono text-slate-600 dark:text-slate-400" }, `${row.original.reorderPoint} units`),
  },
  {
    accessorKey: "status",
    header: "Stock Health",
    cell: ({ row }) => h(StatusBadge, { status: row.original.status || "IN_STOCK", size: "sm" }),
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Inventory Ledger & Stock Levels"
      description="Track stock reservations, safety thresholds, replenishment alerts, and warehouse distribution."
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="handleExportInventory"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="isImportModalOpen = true"
          >
            <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
            <span>Bulk Stock Adjust</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            @click="fetchInventory"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </template>
    </PageHeader>

    <BulkImportModal
      :is-open="isImportModalOpen"
      title="Bulk Stock Adjustment"
      description="Upload an RFC 4180 CSV file to batch adjust stock thresholds, available quantities, and warehouse locations."
      template-filename="inventory_adjustment_template"
      :template-headers="inventoryTemplateHeaders"
      :sample-rows="sampleInventoryRows"
      :rules="inventoryImportRules"
      :is-submitting="isSubmittingAdjustment"
      @close="isImportModalOpen = false"
      @import="handleInventoryAdjustmentSubmit"
    />

    <!-- Inventory Stats Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatsCard
        title="Total Stock Units On Hand"
        :value="totalUnits"
        icon="i-heroicons-cube"
        :loading="isLoading"
      />
      <StatsCard
        title="Low Stock Warning Items"
        :value="lowStockCount"
        icon="i-heroicons-exclamation-triangle"
        :loading="isLoading"
      />
      <StatsCard
        title="Out of Stock Depleted Items"
        :value="outOfStockCount"
        icon="i-heroicons-x-circle"
        :loading="isLoading"
      />
    </div>

    <!-- Inventory Table -->
    <DataTable
      :data="inventoryItems"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search by SKU, product name..."
      empty-title="No inventory records"
      empty-description="All active catalog products will automatically register stock ledger entries here."
    />
  </div>
</template>
