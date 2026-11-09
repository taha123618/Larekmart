<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/composables/useApi";
import type { SellerBalance, SettlementStatement, PayoutRecord } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();

const balance = ref<SellerBalance | null>(null);
const statements = ref<SettlementStatement[]>([]);
const recentPayouts = ref<PayoutRecord[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    const [balRes, stmtRes, payRes] = await Promise.all([
      api.get<any>("/api/v1/sellers/me/balance").catch(() => null),
      api.get<any>("/api/v1/sellers/me/statements").catch(() => []),
      api.get<any>("/api/v1/sellers/me/payouts").catch(() => []),
    ]);

    if (balRes) {
      balance.value = {
        sellerId: balRes.sellerId || "me",
        currency: balRes.currency || "USD",
        availableBalance: Number(balRes.availableBalance ?? 0),
        pendingBalance: Number(balRes.pendingBalance ?? balRes.pendingSettlement ?? 0),
        reservedBalance: Number(balRes.reservedBalance ?? balRes.reserveHold ?? 0),
        totalEarnings: Number(balRes.totalEarnings ?? balRes.lifetimePayouts ?? 0),
        lastPayoutDate: balRes.lastPayoutDate || balRes.lastPayoutAt || null,
        lastPayoutAmount: Number(balRes.lastPayoutAmount ?? 0),
      };
    } else {
      balance.value = {
        sellerId: "me",
        currency: "USD",
        availableBalance: 0,
        pendingBalance: 0,
        reservedBalance: 0,
        totalEarnings: 0,
        lastPayoutDate: null,
        lastPayoutAmount: 0,
      };
    }

    statements.value = Array.isArray(stmtRes)
      ? stmtRes
      : Array.isArray(stmtRes?.statements)
        ? stmtRes.statements
        : [];
    recentPayouts.value = Array.isArray(payRes)
      ? payRes
      : Array.isArray(payRes?.payouts)
        ? payRes.payouts
        : [];
  } catch {
    //
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Financial Accounting & Payouts"
      description="View available balances, settlement cycles, automatic payout schedules, and tax statements."
    >
      <template #actions>
        <NuxtLink
          to="/finance/disputes"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <UIcon name="i-heroicons-shield-exclamation" class="h-4 w-4 text-rose-500" />
          <span>Customer Disputes</span>
        </NuxtLink>
        <NuxtLink
          to="/finance/payouts"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700"
        >
          <UIcon name="i-heroicons-banknotes" class="h-4 w-4" />
          <span>View Payout History</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <div v-if="isLoading" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Loading financial data..." />
    </div>

    <div v-else class="space-y-8">
      <!-- Balance KPI Cards -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Available for Payout"
          :value="balance?.availableBalance?.toLocaleString() || '0.00'"
          prefix="$"
          period="Ready for next cycle"
          icon="i-heroicons-check-badge"
        />

        <StatsCard
          title="Pending Settlement"
          :value="balance?.pendingBalance?.toLocaleString() || '0.00'"
          prefix="$"
          period="Escrow clearing"
          icon="i-heroicons-clock"
        />

        <StatsCard
          title="Reserve Hold"
          :value="balance?.reservedBalance?.toLocaleString() || '0.00'"
          prefix="$"
          period="Chargeback buffer"
          icon="i-heroicons-shield-check"
        />

        <StatsCard
          title="Lifetime Gross Earnings"
          :value="balance?.totalEarnings?.toLocaleString() || '0.00'"
          prefix="$"
          period="Historical volume"
          icon="i-heroicons-chart-bar"
        />
      </div>

      <!-- Recent Payouts Preview -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Recent Disbursed Payouts
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Direct ACH / Wire transfers sent to your registered merchant account
            </p>
          </div>
          <NuxtLink
            to="/finance/payouts"
            class="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
          >
            All Payouts →
          </NuxtLink>
        </div>

        <div v-if="recentPayouts.length === 0" class="py-8 text-center text-xs text-slate-500">
          No disbursements on record yet. Payouts automatically trigger per your schedule once balance thresholds are met.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-slate-200 bg-slate-50 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th class="px-4 py-3">Reference</th>
                <th class="px-4 py-3">Method</th>
                <th class="px-4 py-3">Account</th>
                <th class="px-4 py-3">Amount</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="p in recentPayouts" :key="p.id">
                <td class="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">{{ p.referenceNumber }}</td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ p.method }}</td>
                <td class="px-4 py-3 font-mono text-slate-500">{{ p.destinationAccount }}</td>
                <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">${{ p.amount?.toFixed(2) }} {{ p.currency }}</td>
                <td class="px-4 py-3">
                  <StatusBadge :status="p.status" size="sm" />
                </td>
                <td class="px-4 py-3 text-slate-500">{{ new Date(p.createdAt).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
