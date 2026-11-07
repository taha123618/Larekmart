<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import type { Vendor, Seller } from "~/types";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "onboarding",
  middleware: "auth",
});

const router = useRouter();
const api = useApi();
const sellerStore = useSellerStore();

const vendors = ref<Vendor[]>([]);
const isLoadingVendors = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref("");

const form = ref({
  vendorId: "",
  storeName: "",
  slug: "",
  headline: "",
  description: "",
  primaryCurrency: "USD",
});

onMounted(async () => {
  try {
    const list = await api.get<Vendor[]>("/api/v1/vendors");
    vendors.value = Array.isArray(list) ? list : [];
    if (vendors.value.length > 0 && vendors.value[0]) {
      form.value.vendorId = vendors.value[0].id;
    }
  } catch (err: unknown) {
    errorMessage.value = "Failed to load registered vendor entities. Please ensure step 2 is complete.";
  } finally {
    isLoadingVendors.value = false;
  }
});

// Auto-generate slug from store name
const handleNameChange = () => {
  if (!form.value.slug || form.value.slug.length === 0) {
    form.value.slug = form.value.storeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
};

const handleSubmit = async () => {
  if (!form.value.vendorId) {
    errorMessage.value = "Please select an active vendor organization.";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    const newSeller = await api.post<Seller>("/api/v1/sellers", {
      vendorId: form.value.vendorId,
      storeName: form.value.storeName,
      slug: form.value.slug,
      primaryCurrency: form.value.primaryCurrency,
      headline: form.value.headline || undefined,
      description: form.value.description || undefined,
    });

    sellerStore.setSellers([newSeller]);
    sellerStore.setActiveSeller(newSeller.id);

    await router.push("/onboarding/status");
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Failed to create seller storefront";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-10 dark:border-slate-800 dark:bg-slate-900">
    <div v-if="isLoadingVendors" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Loading vendor organizations..." />
    </div>

    <div v-else>
      <div>
        <span class="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
          Step 3 of 4
        </span>
        <h2 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Configure Your Marketplace Storefront
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Give your storefront a recognizable brand name, custom URL slug, and operating currency.
        </p>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
          {{ errorMessage }}
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <!-- Vendor Selector -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Parent Vendor Entity *
            </label>
            <select
              v-model="form.vendorId"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option v-for="v in vendors" :key="v.id" :value="v.id">
                {{ v.legalBusinessName }} ({{ v.organizationType }} - {{ v.taxIdentificationNumber }})
              </option>
            </select>
          </div>

          <!-- Store Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Public Store Name *
            </label>
            <input
              v-model="form.storeName"
              type="text"
              required
              placeholder="e.g. Urban Tech Store"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              @blur="handleNameChange"
            />
          </div>

          <!-- Slug -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Store URL Slug *
            </label>
            <div class="mt-1.5 flex rounded-lg border border-slate-300 dark:border-slate-700">
              <span class="inline-flex items-center rounded-l-lg border-r border-slate-300 bg-slate-50 px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                larekmart.com/stores/
              </span>
              <input
                v-model="form.slug"
                type="text"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                placeholder="urban-tech-store"
                class="w-full rounded-r-lg px-3.5 py-2 text-xs focus:outline-none dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Currency -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Primary Currency *
            </label>
            <select
              v-model="form.primaryCurrency"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="PKR">PKR — Pakistani Rupee (₨)</option>
              <option value="CAD">CAD — Canadian Dollar (C$)</option>
            </select>
          </div>

          <!-- Headline -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Store Headline (Optional)
            </label>
            <input
              v-model="form.headline"
              type="text"
              placeholder="Premium consumer electronics & accessories"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <!-- Description -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              About Your Store
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Tell customers about your mission, product quality standards, and fulfillment speed..."
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
          <NuxtLink
            to="/onboarding/vendor"
            class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Back to Vendor
          </NuxtLink>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <LoadingSpinner v-if="isSubmitting" size="sm" />
            <span>Launch Store & Review Status</span>
            <UIcon v-if="!isSubmitting" name="i-heroicons-arrow-right" class="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
