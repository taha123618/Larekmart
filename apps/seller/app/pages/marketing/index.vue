<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/composables/useApi";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import EmptyState from "~/components/ui/EmptyState.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "UPCOMING" | "EXPIRED" | "PAUSED";
  budget: number;
  budgetUsed: number;
  redemptionCount: number;
}

const api = useApi();
const promotions = ref<Promotion[]>([]);
const isLoading = ref(true);
const isCreateModalOpen = ref(false);
const isSubmitting = ref(false);

const newPromotion = ref({
  name: "",
  code: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
  discountValue: 10,
  budget: 500,
  durationDays: 14,
});

onMounted(async () => {
  await fetchPromotions();
});

async function fetchPromotions() {
  isLoading.value = true;
  try {
    const data = await api.get<Promotion[]>("/api/v1/promotions").catch(() => []);
    promotions.value = Array.isArray(data) && data.length > 0 ? data : [
      {
        id: "prm_1",
        name: "Spring Tech Super Sale",
        code: "TECHSPRING15",
        discountType: "PERCENTAGE",
        discountValue: 15,
        startDate: new Date(Date.now() - 345600000).toISOString(),
        endDate: new Date(Date.now() + 864000000).toISOString(),
        status: "ACTIVE",
        budget: 1500,
        budgetUsed: 642,
        redemptionCount: 78,
      },
      {
        id: "prm_2",
        name: "First-Time Store Follower Discount",
        code: "WELCOME10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startDate: new Date(Date.now() - 2592000000).toISOString(),
        endDate: new Date(Date.now() + 5184000000).toISOString(),
        status: "ACTIVE",
        budget: 3000,
        budgetUsed: 1890,
        redemptionCount: 215,
      },
      {
        id: "prm_3",
        name: "Flash Weekend Free Shipping Voucher",
        code: "FREESHIP50",
        discountType: "FIXED_AMOUNT",
        discountValue: 10,
        startDate: new Date(Date.now() - 604800000).toISOString(),
        endDate: new Date(Date.now() - 86400000).toISOString(),
        status: "EXPIRED",
        budget: 500,
        budgetUsed: 500,
        redemptionCount: 50,
      },
    ];
  } finally {
    isLoading.value = false;
  }
}

async function handleCreatePromotion() {
  if (!newPromotion.value.name || !newPromotion.value.code) return;
  isSubmitting.value = true;
  try {
    const payload = {
      name: newPromotion.value.name,
      code: newPromotion.value.code.toUpperCase(),
      discountType: newPromotion.value.discountType,
      discountValue: newPromotion.value.discountValue,
      budget: newPromotion.value.budget,
    };

    await api.post("/api/v1/promotions", payload).catch(() => null);

    promotions.value.unshift({
      id: `prm_${Date.now()}`,
      name: payload.name,
      code: payload.code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + newPromotion.value.durationDays * 86400000).toISOString(),
      status: "ACTIVE",
      budget: payload.budget,
      budgetUsed: 0,
      redemptionCount: 0,
    });

    isCreateModalOpen.value = false;
    newPromotion.value = {
      name: "",
      code: "",
      discountType: "PERCENTAGE",
      discountValue: 10,
      budget: 500,
      durationDays: 14,
    };
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Marketing & Store Promotions"
      description="Create discount coupons, participate in marketplace sales events, and accelerate customer conversion."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700"
          @click="isCreateModalOpen = true"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          <span>Create Coupon Code</span>
        </button>
      </template>
    </PageHeader>

    <!-- Marketing KPIs -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Promotional Revenue"
        value="$4,280"
        :change="18.5"
        period="driven by discounts"
        icon="i-heroicons-arrow-trending-up"
      />
      <StatsCard
        title="Active Coupons"
        :value="promotions.filter((p) => p.status === 'ACTIVE').length"
        period="live in checkout"
        icon="i-heroicons-ticket"
      />
      <StatsCard
        title="Total Redemptions"
        :value="promotions.reduce((acc, p) => acc + p.redemptionCount, 0)"
        :change="24.0"
        period="vouchers claimed"
        icon="i-heroicons-shopping-bag"
      />
      <StatsCard
        title="Budget Utilization"
        value="57.8%"
        period="ad & discount budget"
        icon="i-heroicons-calculator"
      />
    </div>

    <!-- Promotions Table Card -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          Active & Past Store Promotions
        </h3>
        <span class="text-xs text-slate-500">
          {{ promotions.length }} total campaigns
        </span>
      </div>

      <div v-if="isLoading" class="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>

      <div v-else-if="promotions.length === 0" class="p-8">
        <EmptyState
          title="No Active Promotions"
          description="Create your first discount coupon to boost product conversions during checkout."
          icon="i-heroicons-ticket"
        >
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            @click="isCreateModalOpen = true"
          >
            Create Coupon
          </button>
        </EmptyState>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-500 uppercase tracking-wider dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3 font-semibold">Campaign Name</th>
              <th class="px-5 py-3 font-semibold">Voucher Code</th>
              <th class="px-5 py-3 font-semibold">Discount</th>
              <th class="px-5 py-3 font-semibold">Status</th>
              <th class="px-5 py-3 font-semibold">Redemptions</th>
              <th class="px-5 py-3 font-semibold">Budget Used</th>
              <th class="px-5 py-3 font-semibold">Schedule</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="p in promotions"
              :key="p.id"
              class="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
            >
              <td class="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                {{ p.name }}
              </td>
              <td class="px-5 py-3.5">
                <span class="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {{ p.code }}
                </span>
              </td>
              <td class="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                {{ p.discountType === 'PERCENTAGE' ? `${p.discountValue}% OFF` : `$${p.discountValue} OFF` }}
              </td>
              <td class="px-5 py-3.5">
                <StatusBadge :status="p.status" />
              </td>
              <td class="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                {{ p.redemptionCount }}
              </td>
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                    <div
                      class="h-full bg-primary-600 rounded-full"
                      :style="{ width: `${Math.min(100, Math.round((p.budgetUsed / p.budget) * 100))}%` }"
                    />
                  </div>
                  <span class="text-[11px] text-slate-500">
                    ${{ p.budgetUsed }} / ${{ p.budget }}
                  </span>
                </div>
              </td>
              <td class="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                {{ new Date(p.startDate).toLocaleDateString() }} - {{ new Date(p.endDate).toLocaleDateString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Coupon Modal -->
    <div
      v-if="isCreateModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Create Store Promotion Coupon
          </h3>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="isCreateModalOpen = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="handleCreatePromotion">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Campaign Name
            </label>
            <input
              v-model="newPromotion.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="e.g. Flash Summer Tech Discount"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Promo Code
              </label>
              <input
                v-model="newPromotion.code"
                type="text"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs uppercase text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="SUMMER20"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Discount Type
              </label>
              <select
                v-model="newPromotion.discountType"
                class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Value ({{ newPromotion.discountType === 'PERCENTAGE' ? '%' : '$' }})
              </label>
              <input
                v-model.number="newPromotion.discountValue"
                type="number"
                min="1"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Max Budget ($)
              </label>
              <input
                v-model.number="newPromotion.budget"
                type="number"
                min="50"
                step="50"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Duration (Days)
              </label>
              <input
                v-model.number="newPromotion.durationDays"
                type="number"
                min="1"
                max="90"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="isCreateModalOpen = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 disabled:opacity-50"
              :disabled="isSubmitting"
            >
              <LoadingSpinner v-if="isSubmitting" class="h-3.5 w-3.5" />
              <span>Launch Campaign</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
