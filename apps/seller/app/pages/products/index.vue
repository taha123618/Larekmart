<script setup lang="ts">
import { ref, onMounted, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import { useNotifications } from "~/composables/useNotifications";
import type { Product } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import BulkImportModal from "~/components/ui/BulkImportModal.vue";
import { exportToCsv, type CsvColumn } from "~/utils/export";
import type { ValidationRule } from "~/utils/csv-parser";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const notify = useNotifications();
const products = ref<Product[]>([]);
const isLoading = ref(true);
const statusFilter = ref<string>("ALL");
const isImportModalOpen = ref(false);
const isImporting = ref(false);

const productImportRules: ValidationRule<any>[] = [
  { field: "name", required: true },
  {
    field: "sku",
    required: true,
    validate: (val) => (/^[a-zA-Z0-9_-]+$/.test(val) ? null : "SKU must contain only letters, numbers, hyphens, and underscores"),
  },
  {
    field: "price",
    required: true,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0 ? null : "Price must be a valid positive number";
    },
    transform: (val) => Number(val),
  },
  {
    field: "stockQuantity",
    required: true,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 ? null : "Stock quantity must be a non-negative integer";
    },
    transform: (val) => Math.round(Number(val)),
  },
  { field: "category", required: false },
  { field: "description", required: false },
];

const sampleTemplateRows = [
  {
    name: "Wireless ANC Headphones",
    sku: "SKU-ANC-001",
    price: 14500,
    stockQuantity: 50,
    category: "Audio & Electronics",
    description: "Premium noise cancelling over-ear headphones with 30-hour battery life",
  },
  {
    name: "USB-C GaN 100W Fast Charger",
    sku: "SKU-GAN-100",
    price: 4500,
    stockQuantity: 120,
    category: "Accessories",
    description: "Ultra-compact fast charger with dual USB-C Power Delivery ports",
  },
];

const templateHeaders = [
  { key: "name", label: "name" },
  { key: "sku", label: "sku" },
  { key: "price", label: "price" },
  { key: "stockQuantity", label: "stockQuantity" },
  { key: "category", label: "category" },
  { key: "description", label: "description" },
];

const handleExportProducts = () => {
  const columns: CsvColumn<Product>[] = [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Product Name" },
    { key: "category", label: "Category" },
    { key: "price", label: "Price", formatter: (v) => `${Number(v).toFixed(2)}` },
    { key: "stockQuantity", label: "Stock Quantity" },
    { key: "status", label: "Status" },
  ];
  exportToCsv("seller_products_catalog", columns, products.value);
};

const handleImportSubmit = async (importedItems: any[]) => {
  isImporting.value = true;
  try {
    let successCount = 0;
    for (const item of importedItems) {
      try {
        await api.post("/api/v1/products", {
          name: item.name,
          sku: item.sku,
          price: item.price,
          stockQuantity: item.stockQuantity,
          category: item.category || "General",
          description: item.description || "",
        });
        successCount++;
      } catch (postErr) {
        // Continue with remainder
      }
    }

    notify.success("Bulk Import Complete", `Successfully imported ${successCount} products into your catalog.`);
    isImportModalOpen.value = false;
    await fetchProducts();
  } catch (err: any) {
    notify.error("Import Failed", err?.message || "Failed to import products.");
  } finally {
    isImporting.value = false;
  }
};

const fetchProducts = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<Product[]>("/api/v1/products");
    products.value = Array.isArray(data) ? data : [];
  } catch {
    products.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchProducts();
});

const columns: ColumnDef<Product, unknown>[] = [
  {
    accessorKey: "name",
    header: "Product Name",
    cell: ({ row }) => {
      const p = row.original;
      return h("div", { class: "flex items-center gap-3" }, [
        h(
          "div",
          {
            class:
              "h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 overflow-hidden shrink-0 dark:bg-slate-800",
          },
          p.images && p.images[0]
            ? h("img", {
                src: p.images[0],
                alt: p.name,
                class: "h-full w-full object-cover",
              })
            : p.name.charAt(0).toUpperCase(),
        ),
        h("div", { class: "truncate max-w-xs" }, [
          h(
            "p",
            {
              class:
                "font-semibold text-xs text-slate-900 dark:text-white truncate",
            },
            p.name,
          ),
          h(
            "p",
            { class: "text-[10px] text-slate-500 dark:text-slate-400" },
            `SKU: ${p.sku}`,
          ),
        ]),
      ]);
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => h("span", { class: "text-xs" }, row.original.category || "General"),
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const p = row.original;
      return h(
        "span",
        { class: "font-semibold text-xs text-slate-900 dark:text-white" },
        `$${Number(p.price).toFixed(2)}`,
      );
    },
  },
  {
    accessorKey: "stockQuantity",
    header: "Inventory Stock",
    cell: ({ row }) => {
      const stock = row.original.stockQuantity;
      const isLow = stock > 0 && stock <= 5;
      const isOut = stock <= 0;
      return h(
        "span",
        {
          class: [
            "text-xs font-medium",
            isOut
              ? "text-rose-600 dark:text-rose-400 font-bold"
              : isLow
              ? "text-amber-600 dark:text-amber-400 font-bold"
              : "text-slate-700 dark:text-slate-300",
          ],
        },
        `${stock} units`,
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(StatusBadge, { status: row.original.status || "ACTIVE", size: "sm" }),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const p = row.original;
      return h("div", { class: "flex items-center gap-2" }, [
        h(
          "a",
          {
            href: `/products/${p.id}/edit`,
            class:
              "rounded px-2 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800",
          },
          "Edit",
        ),
      ]);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Product Catalog"
      description="Manage all items, pricing, inventory stock, and variations available in your store."
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="handleExportProducts"
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
            <span>Bulk Import</span>
          </button>
          <NuxtLink
            to="/products/create"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700"
          >
            <UIcon name="i-heroicons-plus" class="h-4 w-4" />
            <span>New Product</span>
          </NuxtLink>
        </div>
      </template>
    </PageHeader>

    <BulkImportModal
      :is-open="isImportModalOpen"
      title="Bulk Import Product Catalog"
      description="Upload an RFC 4180 CSV spreadsheet to batch create or update multiple catalog products."
      template-filename="products_import_template"
      :template-headers="templateHeaders"
      :sample-rows="sampleTemplateRows"
      :rules="productImportRules"
      :is-submitting="isImporting"
      @close="isImportModalOpen = false"
      @import="handleImportSubmit"
    />

    <DataTable
      :data="products"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search by product name, SKU..."
      empty-title="No products found"
      empty-description="You haven't added any products to your catalog yet. Click below to add your first product."
    >
      <template #toolbar>
        <div class="flex items-center gap-2">
          <select
            v-model="statusFilter"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </template>
    </DataTable>
  </div>
</template>
