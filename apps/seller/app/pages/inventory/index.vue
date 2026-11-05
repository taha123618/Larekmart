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

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const notify = useNotifications();

const inventoryItems = ref<InventoryStock[]>([]);
const isLoading = ref(true);

const fetchInventory = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<InventoryStock[]>("/api/v1/inventory");
    inventoryItems.value = Array.isArray(data) ? data : [];
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
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          @click="fetchInventory"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
          <span>Refresh Stock</span>
        </button>
      </template>
    </PageHeader>

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
