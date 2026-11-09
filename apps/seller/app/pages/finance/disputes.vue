<script setup lang="ts">
import { ref, computed } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import {
  useVendorDisputes,
  useVendorDisputesOverview,
  useSubmitDisputeRebuttal,
} from "~/composables/useSeller";
import type { DisputeStatus, DisputeResponse } from "@repo/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";
import EmptyState from "~/components/ui/EmptyState.vue";

definePageMeta({
  middleware: "seller-access",
});

const sellerStore = useSellerStore();
const activeVendorId = computed(() => sellerStore.activeSeller?.vendorId || null);

const statusFilter = ref<DisputeStatus | undefined>(undefined);
const { data: disputesData, isLoading: isLoadingDisputes } = useVendorDisputes(activeVendorId, statusFilter);
const { data: overview, isLoading: isLoadingOverview } = useVendorDisputesOverview(activeVendorId);
const submitRebuttalMutation = useSubmitDisputeRebuttal();

// Modal State
const isRebuttalModalOpen = ref(false);
const activeDispute = ref<DisputeResponse | null>(null);
const rebuttalText = ref("");
const proofUrl = ref("");
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const disputes = computed(() => disputesData.value?.disputes || []);

function openRebuttal(dispute: DisputeResponse) {
  activeDispute.value = dispute;
  rebuttalText.value = "";
  proofUrl.value = "";
  errorMessage.value = null;
  successMessage.value = null;
  isRebuttalModalOpen.value = true;
}

async function handleRebuttalSubmit() {
  if (!activeDispute.value || !activeVendorId.value) return;
  if (!rebuttalText.value.trim() || rebuttalText.value.length < 10) {
    errorMessage.value = "Rebuttal statement must be at least 10 characters long.";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = null;

  try {
    const proofUrls = proofUrl.value.trim() ? [proofUrl.value.trim()] : [];
    await submitRebuttalMutation.mutateAsync({
      vendorId: activeVendorId.value,
      disputeId: activeDispute.value.id,
      rebuttal: {
        sellerRebuttal: rebuttalText.value,
        sellerEvidenceUrls:
          proofUrls.length > 0
            ? proofUrls
            : ["https://larekmart.com/evidence/submission-placeholder"],
      },
    });

    successMessage.value = "Rebuttal and evidence submitted successfully. Case updated to Under Review.";
    setTimeout(() => {
      isRebuttalModalOpen.value = false;
    }, 1500);
  } catch (err: any) {
    errorMessage.value = err?.message || "Failed to submit rebuttal. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
}

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Customer Disputes & Chargebacks"
      description="Review buyer disputes, track escrow freezes, and submit evidence rebuttals within SLA deadlines."
    >
      <template #actions>
        <NuxtLink
          to="/finance"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          <span>Back to Finance</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- Overview Stats -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Active Disputes"
        :value="((overview?.openCount ?? 0) + (overview?.underReviewCount ?? 0)).toString()"
        period="Requires attention"
        icon="i-heroicons-shield-exclamation"
      />
      <StatsCard
        title="Frozen Balance"
        :value="overview?.totalDisputedAmount ? formatCurrency(overview.totalDisputedAmount) : '$0.00'"
        period="Escrow hold"
        icon="i-heroicons-lock-closed"
      />
      <StatsCard
        title="Pending Rebuttal"
        :value="overview?.evidenceRequestedCount?.toString() || '0'"
        period="7-day SLA window"
        icon="i-heroicons-clock"
      />
      <StatsCard
        title="Resolved Disputes"
        :value="overview?.resolvedCount?.toString() || '0'"
        period="Historical cases"
        icon="i-heroicons-check-circle"
      />
    </div>

    <!-- Filter Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
      <div class="flex items-center gap-2">
        <button
          type="button"
          :class="[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            !statusFilter
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          ]"
          @click="statusFilter = undefined"
        >
          All Disputes
        </button>
        <button
          type="button"
          :class="[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            statusFilter === 'OPENED'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          ]"
          @click="statusFilter = 'OPENED'"
        >
          Awaiting Rebuttal
        </button>
        <button
          type="button"
          :class="[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            statusFilter === 'UNDER_REVIEW'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          ]"
          @click="statusFilter = 'UNDER_REVIEW'"
        >
          Under Review
        </button>
        <button
          type="button"
          :class="[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            statusFilter === 'RESOLVED_BUYER_FAVOR'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          ]"
          @click="statusFilter = 'RESOLVED_BUYER_FAVOR'"
        >
          Resolved
        </button>
      </div>
    </div>

    <!-- Disputes List -->
    <div v-if="isLoadingDisputes || isLoadingOverview" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Loading customer disputes..." />
    </div>

    <div v-else-if="disputes.length === 0">
      <EmptyState
        title="No disputes found"
        description="Your store has zero open customer disputes matching the selected filter criteria."
        icon="i-heroicons-shield-check"
      />
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" class="px-6 py-3 font-semibold">Case ID</th>
              <th scope="col" class="px-6 py-3 font-semibold">Order / Item</th>
              <th scope="col" class="px-6 py-3 font-semibold">Reason</th>
              <th scope="col" class="px-6 py-3 font-semibold">Disputed Amount</th>
              <th scope="col" class="px-6 py-3 font-semibold">Status</th>
              <th scope="col" class="px-6 py-3 font-semibold">Created Date</th>
              <th scope="col" class="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            <tr v-for="d in disputes" :key="d.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <td class="px-6 py-4 font-mono font-bold text-xs text-slate-900 dark:text-white">
                {{ d.id.slice(0, 8) }}
              </td>
              <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">
                Order #{{ d.orderId ? d.orderId.slice(0, 8) : 'N/A' }}
              </td>
              <td class="px-6 py-4">
                <div class="max-w-xs truncate font-medium text-slate-800 dark:text-slate-200">{{ d.type.replace(/_/g, ' ') }}</div>
                <div v-if="d.buyerClaim" class="max-w-xs truncate text-xs text-slate-500">{{ d.buyerClaim }}</div>
              </td>
              <td class="px-6 py-4 font-semibold text-rose-600 dark:text-rose-400">
                {{ formatCurrency(d.disputedAmount, d.currency) }}
              </td>
              <td class="px-6 py-4">
                <StatusBadge :status="d.status" />
              </td>
              <td class="px-6 py-4 text-xs text-slate-500">
                {{ new Date(d.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  v-if="d.status === 'OPENED' || !d.sellerRebuttal"
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition"
                  @click="openRebuttal(d)"
                >
                  <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="h-3.5 w-3.5" />
                  <span>Submit Rebuttal</span>
                </button>
                <span v-else class="text-xs text-slate-400 italic">
                  Rebuttal Filed
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rebuttal Modal -->
    <div v-if="isRebuttalModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-shield-exclamation" class="h-5 w-5 text-primary-500" />
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Submit Dispute Defense</h3>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="isRebuttalModalOpen = false">
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <div v-if="errorMessage" class="mt-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-600 dark:text-rose-400">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          {{ successMessage }}
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="handleRebuttalSubmit">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Defense Statement <span class="text-rose-500">*</span>
            </label>
            <textarea
              v-model="rebuttalText"
              rows="4"
              required
              minlength="10"
              class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:outline-hidden"
              placeholder="State your operational defense, shipment tracking details, delivery proof, or merchant fulfillment confirmation..."
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Supporting Proof URL (Optional)
            </label>
            <input
              v-model="proofUrl"
              type="url"
              class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:outline-hidden"
              placeholder="https://carrier-tracking.com/proof/123.pdf"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              @click="isRebuttalModalOpen = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 disabled:opacity-50 transition"
            >
              <UIcon v-if="isSubmitting" name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
              <span>{{ isSubmitting ? 'Submitting...' : 'Submit Evidence' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
