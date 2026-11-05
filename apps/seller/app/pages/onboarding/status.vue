<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSellerStore } from "~/stores/seller.store";
import { useApi } from "~/composables/useApi";
import type { Seller } from "~/types";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "onboarding",
  middleware: "auth",
});

const router = useRouter();
const sellerStore = useSellerStore();
const api = useApi();

const isLoading = ref(true);
const seller = ref<Seller | null>(null);

const refreshStatus = async () => {
  isLoading.value = true;
  try {
    const list = await api.get<Seller[]>("/api/v1/sellers/me");
    if (Array.isArray(list) && list.length > 0) {
      sellerStore.setSellers(list);
      seller.value = sellerStore.activeSeller;
    }
  } catch {
    //
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void refreshStatus();
});

const goToDashboard = () => {
  void router.push("/dashboard");
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-10 dark:border-slate-800 dark:bg-slate-900">
    <div v-if="isLoading" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Checking merchant status..." />
    </div>

    <div v-else class="text-center">
      <span class="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
        Step 4 of 4
      </span>

      <div class="mt-6 flex justify-center">
        <div
          :class="[
            'flex h-16 w-16 items-center justify-center rounded-2xl',
            seller?.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
              : seller?.status === 'SUSPENDED'
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
          ]"
        >
          <UIcon
            :name="
              seller?.status === 'ACTIVE'
                ? 'i-heroicons-check-circle'
                : seller?.status === 'SUSPENDED'
                ? 'i-heroicons-x-circle'
                : 'i-heroicons-clock'
            "
            class="h-9 w-9"
          />
        </div>
      </div>

      <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {{
          seller?.status === "ACTIVE"
            ? "Your Store is Approved & Active!"
            : seller?.status === "SUSPENDED"
            ? "Account Under Review / Suspended"
            : "Application Submitted for Verification"
        }}
      </h2>

      <p class="mx-auto mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
        Storefront: <span class="font-semibold text-slate-700 dark:text-slate-300">{{ seller?.store?.name || "Merchant Store" }}</span>
        • ID: {{ seller?.id || "N/A" }}
      </p>

      <div class="mt-4">
        <StatusBadge :status="seller?.status || 'PENDING'" size="lg" />
      </div>

      <!-- Detail Card -->
      <div class="mx-auto mt-8 max-w-lg rounded-xl border border-slate-100 bg-slate-50/70 p-5 text-left text-xs dark:border-slate-800 dark:bg-slate-800/40">
        <h4 class="font-semibold text-slate-900 dark:text-white mb-2">Onboarding Verification Pipeline</h4>
        <ul class="space-y-2 text-slate-600 dark:text-slate-400">
          <li class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-emerald-600" />
            <span>Clerk Authentication & Session Provisioned</span>
          </li>
          <li class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-emerald-600" />
            <span>Corporate Entity & Tax Identification Registered</span>
          </li>
          <li class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-emerald-600" />
            <span>Multi-currency Storefront Metadata Created</span>
          </li>
          <li class="flex items-center gap-2">
            <UIcon
              :name="seller?.status === 'ACTIVE' ? 'i-heroicons-check-circle' : 'i-heroicons-arrow-path'"
              :class="['h-4 w-4', seller?.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-500 animate-spin']"
            />
            <span>KYB Compliance & Anti-Fraud Automated Clearance</span>
          </li>
        </ul>
      </div>

      <!-- Action Buttons -->
      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="refreshStatus"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
          <span>Refresh Status</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @click="goToDashboard"
        >
          <span>Enter Seller Dashboard</span>
          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
