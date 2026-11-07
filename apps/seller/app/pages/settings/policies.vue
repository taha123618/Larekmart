<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import { useNotifications } from "~/composables/useNotifications";
import type { SellerPolicy, PolicyType } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const sellerStore = useSellerStore();
const notify = useNotifications();

const sellerId = computed(() => sellerStore.activeSellerId);

const activePolicyType = ref<PolicyType>("SHIPPING");
const policies = ref<Record<string, SellerPolicy>>({});
const isLoading = ref(true);
const isSaving = ref(false);

const form = ref({
  title: "",
  content: "",
});

const policyTypes: { key: PolicyType; label: string; desc: string }[] = [
  { key: "SHIPPING", label: "Shipping Policy", desc: "Estimated delivery windows, carrier services, handling times." },
  { key: "RETURNS", label: "Return & Refund Policy", desc: "Return eligibility period, restocking fee, return shipping rules." },
  { key: "PRIVACY", label: "Customer Privacy Notice", desc: "How buyer contact and fulfillment data is treated." },
  { key: "TERMS", label: "Terms of Sale & Warranty", desc: "Warranty limitations, manufacturer guarantee clauses." },
];

const loadPolicies = async () => {
  if (!sellerId.value) return;
  isLoading.value = true;
  try {
    const list = await api.get<SellerPolicy[]>(`/api/v1/sellers/${sellerId.value}/policies`);
    if (Array.isArray(list)) {
      list.forEach((p) => {
        policies.value[p.policyType] = p;
      });
    }
    selectPolicyType(activePolicyType.value);
  } catch {
    //
  } finally {
    isLoading.value = false;
  }
};

const selectPolicyType = (type: PolicyType) => {
  activePolicyType.value = type;
  const existing = policies.value[type];
  if (existing) {
    form.value = {
      title: existing.title,
      content: existing.content,
    };
  } else {
    form.value = {
      title: `${type.charAt(0) + type.slice(1).toLowerCase()} Policy`,
      content: "",
    };
  }
};

onMounted(() => {
  void loadPolicies();
});

const handleSavePolicy = async () => {
  if (!sellerId.value) return;
  isSaving.value = true;
  try {
    const payload = {
      policyType: activePolicyType.value,
      title: form.value.title,
      content: form.value.content,
    };

    const saved = await api.put<SellerPolicy>(`/api/v1/sellers/${sellerId.value}/policies`, payload);
    policies.value[activePolicyType.value] = saved;
    notify.success("Policy Saved", `${activePolicyType.value} policy has been updated.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update policy";
    notify.error("Error", msg);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <PageHeader
      title="Storefront Policies & Compliance"
      description="Define customer-facing shipping estimates, return windows, privacy guarantees, and terms of service."
    />

    <!-- Settings Subnav Tabs -->
    <div class="flex border-b border-slate-200 dark:border-slate-800">
      <NuxtLink
        to="/settings"
        class="border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
        class="border-b-2 border-primary-600 px-4 py-2.5 text-xs font-semibold text-primary-600 dark:text-primary-400"
      >
        Store Policies & Terms
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="py-12 text-center">
      <LoadingSpinner size="lg" label="Loading store policies..." />
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <!-- Policy Select Menu -->
      <div class="lg:col-span-1 space-y-2">
        <button
          v-for="p in policyTypes"
          :key="p.key"
          type="button"
          :class="[
            'w-full rounded-xl border p-3.5 text-left transition',
            activePolicyType === p.key
              ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-xs dark:border-primary-600 dark:bg-primary-950/60 dark:text-primary-200'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800',
          ]"
          @click="selectPolicyType(p.key)"
        >
          <p class="font-semibold text-xs">{{ p.label }}</p>
          <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
            {{ p.desc }}
          </p>
        </button>
      </div>

      <!-- Policy Editor Card -->
      <div class="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <form class="space-y-4" @submit.prevent="handleSavePolicy">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Policy Section Title
            </label>
            <input
              v-model="form.title"
              type="text"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Legal Content & Terms
            </label>
            <textarea
              v-model="form.content"
              rows="12"
              required
              placeholder="Outline exact guidelines, delivery estimates, return timeframes, and customer support contact clauses..."
              class="mt-1.5 w-full font-mono rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed"
            />
          </div>

          <div class="flex justify-end pt-3">
            <button
              type="submit"
              :disabled="isSaving"
              class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
            >
              <LoadingSpinner v-if="isSaving" size="sm" />
              <span>Update {{ activePolicyType }} Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
