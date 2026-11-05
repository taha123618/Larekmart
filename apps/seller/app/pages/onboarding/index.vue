<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useApi } from "~/composables/useApi";
import type { Vendor } from "~/types";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "onboarding",
  middleware: "auth",
});

const router = useRouter();
const api = useApi();

const isChecking = ref(true);
const existingVendor = ref<Vendor | null>(null);

onMounted(async () => {
  try {
    const vendors = await api.get<Vendor[]>("/api/v1/vendors").catch(() => []);
    if (Array.isArray(vendors) && vendors.length > 0 && vendors[0]) {
      existingVendor.value = vendors[0];
    }
  } catch {
    // No vendor found or route returned 404
  } finally {
    isChecking.value = false;
  }
});

const handleContinue = () => {
  if (existingVendor.value) {
    void router.push("/onboarding/seller");
  } else {
    void router.push("/onboarding/vendor");
  }
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-10 dark:border-slate-800 dark:bg-slate-900">
    <div v-if="isChecking" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Checking existing merchant profile..." />
      <p class="mt-4 text-xs text-slate-500">Retrieving business entity status...</p>
    </div>

    <div v-else class="space-y-8">
      <div>
        <span class="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
          Step 1 of 4
        </span>
        <h2 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Welcome to LarekMart Merchant Network
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Scale your enterprise, manage catalog inventory, and fulfill customer orders through our high-performance global marketplace.
        </p>
      </div>

      <!-- Feature Highlights Grid -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <UIcon name="i-heroicons-globe-alt" class="h-5 w-5" />
          </div>
          <h3 class="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Multichannel Reach
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Instantly showcase catalog items to buyers across mobile, desktop, and partner stores.
          </p>
        </div>

        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <UIcon name="i-heroicons-banknotes" class="h-5 w-5" />
          </div>
          <h3 class="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Automated Payouts
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Transparent double-entry ledgers with automated settlement cycles to your bank account.
          </p>
        </div>

        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
            <UIcon name="i-heroicons-shield-check" class="h-5 w-5" />
          </div>
          <h3 class="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Zero-Trust Protection
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Advanced fraud telemetry and secure real-time messaging protect every transaction.
          </p>
        </div>
      </div>

      <!-- Existing Vendor Notification if present -->
      <div
        v-if="existingVendor"
        class="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div class="text-xs">
          <p class="font-semibold text-emerald-900 dark:text-emerald-300">
            Existing Registered Vendor Profile Found
          </p>
          <p class="mt-0.5 text-emerald-700 dark:text-emerald-400">
            Organization: <span class="font-medium">{{ existingVendor.legalBusinessName }}</span> (Status: {{ existingVendor.status }})
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
        <NuxtLink
          to="/login"
          class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel and Sign Out
        </NuxtLink>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @click="handleContinue"
        >
          <span>{{ existingVendor ? "Proceed to Store Setup" : "Register Business Entity" }}</span>
          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
