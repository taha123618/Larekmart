<script setup lang="ts">
import { computed } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import { useSellerPerformance } from "~/composables/useSeller";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import StatsCard from "~/components/ui/StatsCard.vue";

definePageMeta({
  middleware: "seller-access",
});

const sellerStore = useSellerStore();
const sellerId = computed(() => sellerStore.activeSellerId);
const { data: performance } = useSellerPerformance(sellerId);

const sellerStatus = computed(() => {
  return sellerStore.activeSeller?.status || "ACTIVE";
});

const isAccountRestricted = computed(() => {
  return ["SUSPENDED", "UNDER_REVIEW", "INACTIVE"].includes(sellerStatus.value);
});

interface HealthMetric {
  title: string;
  current: string;
  target: string;
  status: "GOOD" | "WARNING" | "CRITICAL";
  description: string;
}

const healthMetrics = computed<HealthMetric[]>(() => {
  const p = performance.value;
  const returnRate = Number(p?.returnRate ?? 0);
  const cancelRate = Number(p?.cancellationRate ?? 0);
  const odr = returnRate + cancelRate;
  const onTime = Number(p?.onTimeDeliveryRate ?? 100);
  const lateDispatch = Math.max(0, 100 - onTime);
  const vtr = onTime;

  return [
    {
      title: "Order Defect Rate (ODR)",
      current: `${odr.toFixed(2)}%`,
      target: "< 1.00%",
      status: odr < 1.0 ? "GOOD" : odr < 2.5 ? "WARNING" : "CRITICAL",
      description: "Percentage of orders with cancellation or unresolved return claims.",
    },
    {
      title: "Late Dispatch Rate",
      current: `${lateDispatch.toFixed(2)}%`,
      target: "< 4.00%",
      status: lateDispatch < 4.0 ? "GOOD" : lateDispatch < 8.0 ? "WARNING" : "CRITICAL",
      description: "Orders confirmed dispatched after the expected shipping window.",
    },
    {
      title: "Valid Tracking Rate (VTR)",
      current: `${vtr.toFixed(1)}%`,
      target: "> 95.0%",
      status: vtr >= 95.0 ? "GOOD" : vtr >= 90.0 ? "WARNING" : "CRITICAL",
      description: "Shipments carrying verified carrier tracking barcodes (TCS, Leopards, DHL, FedEx).",
    },
    {
      title: "Policy & IP Compliance",
      current: sellerStatus.value === "ACTIVE" ? "100%" : "Under Review",
      target: "100%",
      status: sellerStatus.value === "ACTIVE" ? "GOOD" : "WARNING",
      description: "Absence of counterfeit, intellectual property, or prohibited product strikes.",
    },
  ];
});

interface SecurityChecklist {
  id: string;
  title: string;
  status: "COMPLETED" | "PENDING" | "OPTIONAL";
  description: string;
  actionText?: string;
  actionUrl?: string;
}

const securityChecklist = computed<SecurityChecklist[]>(() => {
  const seller = sellerStore.activeSeller;
  const isKybVerified = Boolean(seller?.vendorId);
  const isBankSetup = Boolean(seller?.primaryCurrency);

  return [
    {
      id: "kyb",
      title: "Legal Business Entity Verification (KYB)",
      status: isKybVerified ? "COMPLETED" : "PENDING",
      description: isKybVerified
        ? "Government NTN/Tax ID and incorporation papers verified by marketplace compliance team."
        : "Vendor identity verification pending submission or approval.",
      actionText: isKybVerified ? undefined : "Complete KYB",
      actionUrl: isKybVerified ? undefined : "/onboarding/vendor",
    },
    {
      id: "payout",
      title: "Settlement Bank Account Routing",
      status: isBankSetup ? "COMPLETED" : "PENDING",
      description: isBankSetup
        ? "Primary currency and disbursement credentials configured for marketplace payouts."
        : "Bank settlement details required to receive automated store payouts.",
      actionText: isBankSetup ? undefined : "Configure Payouts",
      actionUrl: isBankSetup ? undefined : "/finance",
    },
    {
      id: "2fa",
      title: "Multi-Factor Authentication (MFA)",
      status: "COMPLETED",
      description: "Clerk-secured multi-factor identity verified on primary store owner session.",
    },
    {
      id: "staff_audit",
      title: "Staff Permission & Role Recertification",
      status: "OPTIONAL",
      description: "Review of active sub-accounts, delegated store managers, and staff tokens.",
      actionText: "Manage Team",
      actionUrl: "/settings/staff",
    },
  ];
});
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Account Health & Security"
      description="Monitor customer experience benchmarks, policy compliance, account status, and store security requirements."
    />

    <!-- Account Status Alert Banner -->
    <div
      :class="[
        'rounded-xl border p-5 shadow-xs transition',
        isAccountRestricted
          ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200'
          : 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/15 dark:text-emerald-200',
      ]"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3.5">
          <div
            :class="[
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              isAccountRestricted
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-600 text-white',
            ]"
          >
            <UIcon
              :name="isAccountRestricted ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-shield-check'"
              class="h-5 w-5"
            />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold">
                {{ isAccountRestricted ? 'Account Capabilities Restricted' : 'Account in Excellent Standing' }}
              </h3>
              <StatusBadge :status="sellerStatus" />
            </div>
            <p class="mt-1 text-xs opacity-90">
              {{
                isAccountRestricted
                  ? 'Your store is currently under review or paused. Listing creations and checkout routing may be suspended.'
                  : 'Your storefront operates with full marketplace privileges. All performance metrics comply with seller standards.'
              }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <NuxtLink
            v-if="isAccountRestricted"
            to="/support/create"
            class="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
            <span>Submit Appeal</span>
          </NuxtLink>
          <NuxtLink
            to="/support"
            class="inline-flex items-center gap-1.5 rounded-lg border border-current px-3.5 py-1.5 text-xs font-semibold hover:opacity-80"
          >
            <UIcon name="i-heroicons-question-mark-circle" class="h-4 w-4" />
            <span>Contact Compliance</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Health Metrics Grid -->
    <div>
      <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3">
        Customer Service Performance Metrics
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="metric in healthMetrics"
          :key="metric.title"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
              {{ metric.title }}
            </span>
            <span class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              Good
            </span>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-slate-900 dark:text-white">
              {{ metric.current }}
            </span>
            <span class="text-xs text-slate-400">
              target: {{ metric.target }}
            </span>
          </div>
          <p class="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ metric.description }}
          </p>
        </div>
      </div>
    </div>

    <!-- Security & Verification Checklist -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="border-b border-slate-100 p-4 dark:border-slate-800">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          Required Store Security & Compliance Checklist
        </h3>
        <p class="mt-0.5 text-xs text-slate-500">
          Ensure all identity, banking, and authorization checks remain authenticated to prevent payment holds.
        </p>
      </div>

      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="item in securityChecklist"
          :key="item.id"
          class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 text-emerald-600 dark:text-emerald-400">
              <UIcon
                :name="item.status === 'COMPLETED' ? 'i-heroicons-check-circle' : 'i-heroicons-clock'"
                class="h-5 w-5"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">
                  {{ item.title }}
                </h4>
                <span
                  v-if="item.status === 'COMPLETED'"
                  class="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                >
                  Verified
                </span>
                <span
                  v-else
                  class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  Optional
                </span>
              </div>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {{ item.description }}
              </p>
            </div>
          </div>

          <NuxtLink
            v-if="item.actionUrl"
            :to="item.actionUrl"
            class="inline-flex items-center gap-1 self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:self-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span>{{ item.actionText }}</span>
            <UIcon name="i-heroicons-arrow-right" class="h-3 w-3" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
