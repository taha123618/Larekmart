<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useApi } from "~/composables/useApi";
import type { Vendor, OrganizationType } from "~/types";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "onboarding",
  middleware: "auth",
});

const router = useRouter();
const api = useApi();

const isSubmitting = ref(false);
const errorMessage = ref("");

const form = ref({
  name: "",
  legalBusinessName: "",
  organizationType: "LLC" as OrganizationType,
  taxIdentificationNumber: "",
  businessRegistrationNumber: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  country: "United States",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  website: "",
});

const handleSubmit = async () => {
  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    const payload = {
      ...form.value,
      name: form.value.name || form.value.legalBusinessName,
    };
    await api.post<Vendor>("/api/v1/vendors", payload);
    await router.push("/onboarding/seller");
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Failed to register vendor organization";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-10 dark:border-slate-800 dark:bg-slate-900">
    <div>
      <span class="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
        Step 2 of 4
      </span>
      <h2 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        Register Legal Business Entity (Vendor)
      </h2>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
        LarekMart operates as an enterprise marketplace. All seller stores must be backed by a verified legal entity for tax, compliance, and settlement purposes.
      </p>
    </div>

    <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
      <div v-if="errorMessage" class="rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
        {{ errorMessage }}
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Legal Business Name *
          </label>
          <input
            v-model="form.legalBusinessName"
            type="text"
            required
            placeholder="e.g. Apex Global Trading LLC"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Organization Type *
          </label>
          <select
            v-model="form.organizationType"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="LLC">Limited Liability Company (LLC)</option>
            <option value="CORPORATION">Corporation (Inc./Corp.)</option>
            <option value="PARTNERSHIP">General / Limited Partnership</option>
            <option value="SOLE_PROPRIETORSHIP">Sole Proprietorship</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tax ID / EIN Number *
          </label>
          <input
            v-model="form.taxIdentificationNumber"
            type="text"
            required
            placeholder="XX-XXXXXXX"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Business Registration / License Number *
          </label>
          <input
            v-model="form.businessRegistrationNumber"
            type="text"
            required
            placeholder="e.g. REG-9842104"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Primary Contact Email *
          </label>
          <input
            v-model="form.primaryContactEmail"
            type="email"
            required
            placeholder="compliance@yourcompany.com"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Primary Contact Phone *
          </label>
          <input
            v-model="form.primaryContactPhone"
            type="tel"
            required
            placeholder="+1 (555) 000-0000"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <!-- Address Group -->
      <div class="border-t border-slate-100 pt-6 dark:border-slate-800">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-4">
          Registered Headquarters Address
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Street Address *
            </label>
            <input
              v-model="form.addressLine1"
              type="text"
              required
              placeholder="123 Commerce Boulevard, Suite 400"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              City *
            </label>
            <input
              v-model="form.city"
              type="text"
              required
              placeholder="San Francisco"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              State / Province *
            </label>
            <input
              v-model="form.state"
              type="text"
              required
              placeholder="CA"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Postal / ZIP Code *
            </label>
            <input
              v-model="form.postalCode"
              type="text"
              required
              placeholder="94105"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Country *
            </label>
            <input
              v-model="form.country"
              type="text"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <!-- Navigation Actions -->
      <div class="flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
        <NuxtLink
          to="/onboarding"
          class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Back to Overview
        </NuxtLink>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <LoadingSpinner v-if="isSubmitting" size="sm" />
          <span>Save & Continue to Store Setup</span>
          <UIcon v-if="!isSubmitting" name="i-heroicons-arrow-right" class="h-4 w-4" />
        </button>
      </div>
    </form>
  </div>
</template>
