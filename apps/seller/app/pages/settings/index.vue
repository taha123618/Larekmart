<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import { useNotifications } from "~/composables/useNotifications";
import type { SellerStore, SellerSettings } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const sellerStore = useSellerStore();
const notify = useNotifications();

const sellerId = computed(() => sellerStore.activeSellerId);

const isLoading = ref(true);
const isSaving = ref(false);

const storeForm = ref({
  name: "",
  headline: "",
  description: "",
  vacationMode: false,
  vacationMessage: "",
});

const settingsForm = ref({
  defaultCurrency: "USD",
  autoAcceptOrders: true,
  lowStockThreshold: 5,
  supportEmail: "",
  supportPhone: "",
});

onMounted(async () => {
  if (!sellerId.value) return;
  try {
    const [storeData, settingsData] = await Promise.all([
      api.get<SellerStore>(`/api/v1/sellers/${sellerId.value}/storefront`).catch(() => null),
      api.get<SellerSettings>(`/api/v1/sellers/${sellerId.value}/settings`).catch(() => null),
    ]);

    if (storeData) {
      storeForm.value = {
        name: storeData.name || "",
        headline: storeData.headline || "",
        description: storeData.description || "",
        vacationMode: Boolean(storeData.vacationMode),
        vacationMessage: storeData.vacationMessage || "",
      };
    }

    if (settingsData) {
      settingsForm.value = {
        defaultCurrency: settingsData.defaultCurrency || "USD",
        autoAcceptOrders: Boolean(settingsData.autoAcceptOrders),
        lowStockThreshold: settingsData.lowStockThreshold || 5,
        supportEmail: settingsData.supportEmail || "",
        supportPhone: settingsData.supportPhone || "",
      };
    }
  } catch {
    //
  } finally {
    isLoading.value = false;
  }
});

const handleSave = async () => {
  if (!sellerId.value) return;
  isSaving.value = true;
  try {
    await Promise.all([
      api.patch(`/api/v1/sellers/${sellerId.value}/storefront`, storeForm.value),
      api.patch(`/api/v1/sellers/${sellerId.value}/settings`, settingsForm.value),
    ]);
    notify.success("Settings Saved", "Your storefront configuration has been updated.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update settings";
    notify.error("Error", msg);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <PageHeader
      title="Storefront & Operational Settings"
      description="Manage brand identity, contact channels, fulfillment automation, and operational thresholds."
    />

    <!-- Settings Subnav Tabs -->
    <div class="flex border-b border-slate-200 dark:border-slate-800">
      <NuxtLink
        to="/settings"
        class="border-b-2 border-primary-600 px-4 py-2.5 text-xs font-semibold text-primary-600 dark:text-primary-400"
      >
        General Storefront
      </NuxtLink>
      <NuxtLink
        to="/settings/staff"
        class="border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        Team & Staff Permissions
      </NuxtLink>
      <NuxtLink
        to="/settings/policies"
        class="border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        Store Policies & Terms
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Loading store settings..." />
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSave">
      <!-- Store Branding Section -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Store Identity</h3>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Display Store Name
            </label>
            <input
              v-model="storeForm.name"
              type="text"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Store Headline
            </label>
            <input
              v-model="storeForm.headline"
              type="text"
              placeholder="e.g. Official flagship audio gear"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              About the Store
            </label>
            <textarea
              v-model="storeForm.description"
              rows="3"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <!-- Operational Rules Section -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Operations & Automation</h3>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Low Stock Warning Threshold
            </label>
            <input
              v-model.number="settingsForm.lowStockThreshold"
              type="number"
              min="1"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Customer Support Email
            </label>
            <input
              v-model="settingsForm.supportEmail"
              type="email"
              placeholder="support@yourstore.com"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="sm:col-span-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <p class="text-xs font-semibold text-slate-900 dark:text-white">Automatic Order Confirmation</p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Immediately transition paid orders to PROCESSING without requiring manual merchant approval.
              </p>
            </div>
            <input
              v-model="settingsForm.autoAcceptOrders"
              type="checkbox"
              class="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500"
            />
          </div>

          <div class="sm:col-span-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <p class="text-xs font-semibold text-slate-900 dark:text-white">Vacation / Maintenance Mode</p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Temporarily pause new order checkouts while keeping your catalog visible to browsing customers.
              </p>
            </div>
            <input
              v-model="storeForm.vacationMode"
              type="checkbox"
              class="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-4">
        <button
          type="submit"
          :disabled="isSaving"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
        >
          <LoadingSpinner v-if="isSaving" size="sm" />
          <span>Save Settings</span>
        </button>
      </div>
    </form>
  </div>
</template>
