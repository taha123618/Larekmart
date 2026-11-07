<script setup lang="ts">
import { ref, onMounted, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import type { SupportTicket } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const tickets = ref<SupportTicket[]>([]);
const isLoading = ref(true);

const fetchTickets = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<any>("/api/v1/support/tickets");
    tickets.value = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : [];
  } catch {
    tickets.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchTickets();
});

const columns: ColumnDef<SupportTicket, unknown>[] = [
  {
    accessorKey: "ticketNumber",
    header: "Ticket ID",
    cell: ({ row }) =>
      h("span", { class: "font-mono font-bold text-xs text-primary-600 dark:text-primary-400" }, `#${row.original.ticketNumber || row.original.id.slice(0, 6)}`),
  },
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) =>
      h("div", {}, [
        h("p", { class: "font-semibold text-xs text-slate-900 dark:text-white" }, row.original.subject),
        h("p", { class: "text-[10px] text-slate-500 capitalize" }, `Category: ${row.original.category?.toLowerCase()}`),
      ]),
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => {
      const p = row.original.priority;
      const color =
        p === "URGENT" || p === "HIGH"
          ? "text-rose-600 font-bold"
          : p === "MEDIUM"
          ? "text-amber-600 font-semibold"
          : "text-slate-500";
      return h("span", { class: ["text-xs", color] }, p);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(StatusBadge, { status: row.original.status || "OPEN", size: "sm" }),
  },
  {
    accessorKey: "lastRepliedAt",
    header: "Last Update",
    cell: ({ row }) => {
      const d = row.original.lastRepliedAt ? new Date(row.original.lastRepliedAt).toLocaleDateString() : "Just now";
      return h("span", { class: "text-xs text-slate-500" }, d);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Merchant Support Desk"
      description="Submit escalations, dispute claims, operational inquiries, and track ticket resolutions."
    >
      <template #actions>
        <NuxtLink
          to="/support/create"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          <span>New Support Ticket</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <DataTable
      :data="tickets"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search tickets by subject, ID..."
      empty-title="No support tickets"
      empty-description="Have an inquiry or issue with payouts, catalog, or buyer disputes? Open a ticket to receive 24/7 dedicated seller assistance."
    />
  </div>
</template>
