<script setup lang="ts">
import { ref, onMounted, h, computed } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import type { Order, OrderStatus } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const orders = ref<Order[]>([]);
const isLoading = ref(true);
const selectedStatus = ref<string>("ALL");

const fetchOrders = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<Order[]>("/api/v1/orders");
    orders.value = Array.isArray(data) ? data : [];
  } catch {
    orders.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchOrders();
});

const filteredOrders = computed(() => {
  if (selectedStatus.value === "ALL") return orders.value;
  return orders.value.filter((o) => o.status === selectedStatus.value);
});

const columns: ColumnDef<Order, unknown>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order Number",
    cell: ({ row }) => {
      const o = row.original;
      return h(
        "a",
        {
          href: `/orders/${o.id}`,
          class: "font-mono font-bold text-xs text-primary-600 hover:underline dark:text-primary-400",
        },
        `#${o.orderNumber || o.id.slice(0, 8)}`,
      );
    },
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => {
      const o = row.original;
      return h("div", {}, [
        h("p", { class: "font-semibold text-xs text-slate-900 dark:text-white" }, o.customerName || "Customer"),
        h("p", { class: "text-[10px] text-slate-500" }, o.customerEmail || ""),
      ]);
    },
  },
  {
    accessorKey: "itemsCount",
    header: "Line Items",
    cell: ({ row }) =>
      h("span", { class: "text-xs text-slate-600 dark:text-slate-400" }, `${row.original.itemsCount || row.original.items?.length || 1} items`),
  },
  {
    accessorKey: "totalAmount",
    header: "Total Value",
    cell: ({ row }) =>
      h(
        "span",
        { class: "font-bold text-xs text-slate-900 dark:text-white" },
        `$${Number(row.original.totalAmount).toFixed(2)}`,
      ),
  },
  {
    accessorKey: "status",
    header: "Fulfillment Status",
    cell: ({ row }) => h(StatusBadge, { status: row.original.status || "CONFIRMED", size: "sm" }),
  },
  {
    accessorKey: "createdAt",
    header: "Order Placed",
    cell: ({ row }) => {
      const dateStr = row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "Today";
      return h("span", { class: "text-xs text-slate-500" }, dateStr);
    },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) =>
      h(
        "a",
        {
          href: `/orders/${row.original.id}`,
          class: "rounded px-2.5 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800",
        },
        "View Detail",
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Customer Orders"
      description="Process and fulfill incoming customer orders, manage shipping labels, and track delivery status."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          @click="fetchOrders"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
          <span>Refresh Orders</span>
        </button>
      </template>
    </PageHeader>

    <!-- Status Tabs Toolbar -->
    <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
      <button
        v-for="status in (['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const)"
        :key="status"
        type="button"
        :class="[
          'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
          selectedStatus === status
            ? 'bg-primary-600 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
        ]"
        @click="selectedStatus = status"
      >
        {{ status }}
      </button>
    </div>

    <!-- Orders Table -->
    <DataTable
      :data="filteredOrders"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search by order number, customer name, email..."
      empty-title="No orders found"
      empty-description="No customer orders currently match the selected fulfillment status filter."
    />
  </div>
</template>
