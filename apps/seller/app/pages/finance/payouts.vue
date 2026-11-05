<script setup lang="ts">
import { ref, onMounted, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import type { PayoutRecord } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const payouts = ref<PayoutRecord[]>([]);
const isLoading = ref(true);

const fetchPayouts = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<PayoutRecord[]>("/api/v1/sellers/me/payouts");
    payouts.value = Array.isArray(data) ? data : [];
  } catch {
    payouts.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchPayouts();
});

const columns: ColumnDef<PayoutRecord, unknown>[] = [
  {
    accessorKey: "referenceNumber",
    header: "Transaction Reference",
    cell: ({ row }) =>
      h("span", { class: "font-mono font-bold text-xs text-slate-900 dark:text-white" }, row.original.referenceNumber),
  },
  {
    accessorKey: "method",
    header: "Disbursement Method",
    cell: ({ row }) => h("span", { class: "text-xs text-slate-700 dark:text-slate-300" }, row.original.method),
  },
  {
    accessorKey: "destinationAccount",
    header: "Destination Bank / Account",
    cell: ({ row }) =>
      h("span", { class: "font-mono text-xs text-slate-500" }, row.original.destinationAccount),
  },
  {
    accessorKey: "amount",
    header: "Disbursed Amount",
    cell: ({ row }) =>
      h(
        "span",
        { class: "font-bold text-xs text-slate-900 dark:text-white" },
        `$${Number(row.original.amount).toFixed(2)} ${row.original.currency}`,
      ),
  },
  {
    accessorKey: "status",
    header: "Payout Status",
    cell: ({ row }) => h(StatusBadge, { status: row.original.status || "COMPLETED", size: "sm" }),
  },
  {
    accessorKey: "createdAt",
    header: "Initiated Date",
    cell: ({ row }) => {
      const dateStr = row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "-";
      return h("span", { class: "text-xs text-slate-500" }, dateStr);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Payout Transaction History"
      description="Historical log of automated weekly and monthly disbursements transferred from LarekMart."
    >
      <template #actions>
        <NuxtLink
          to="/finance"
          class="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Back to Overview
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
      <div class="flex items-center gap-2 font-semibold">
        <UIcon name="i-heroicons-information-circle" class="h-4 w-4" />
        <span>Settlement Schedule Notice</span>
      </div>
      <p class="mt-1">
        Disbursements occur automatically on a 7-day rolling cycle. Cleared funds above $50.00 are initiated every Monday at 00:00 UTC.
      </p>
    </div>

    <DataTable
      :data="payouts"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search by reference, account..."
      empty-title="No payouts found"
      empty-description="Your payout disbursements will appear here after orders complete their holding period."
    />
  </div>
</template>
