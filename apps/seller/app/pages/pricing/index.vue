<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import { useApi } from "~/composables/useApi";
import { useNotifications } from "~/composables/useNotifications";
import type { Product } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";
import EmptyState from "~/components/ui/EmptyState.vue";
import { exportToCsv, type CsvColumn } from "~/utils/export";

definePageMeta({
  middleware: "seller-access",
});

const sellerStore = useSellerStore();
const api = useApi();
const notify = useNotifications();

const products = ref<Product[]>([]);
const isLoading = ref(true);
const isUpdatingPrice = ref(false);

// Multi-Currency Exchange Rates
const exchangeRates = ref<Record<string, number>>({
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278.5,
});

const currency = computed(() => sellerStore.activeSeller?.primaryCurrency || "PKR");

// Interactive Pricing Simulator State
const simBasePrice = ref<number>(5000);
const simQuantity = ref<number>(12);
const simSelectedCurrency = ref<string>("PKR");

// Tiered Volume Pricing Rules
interface VolumeTier {
  minQty: number;
  maxQty?: number;
  discountPercent: number;
  tierName: string;
}

const volumeTiers = ref<VolumeTier[]>([
  { minQty: 1, maxQty: 9, discountPercent: 0, tierName: "Standard Retail" },
  { minQty: 10, maxQty: 49, discountPercent: 5, tierName: "Volume Tier 1" },
  { minQty: 50, maxQty: 99, discountPercent: 10, tierName: "Bulk Tier 2" },
  { minQty: 100, discountPercent: 15, tierName: "Wholesale Partner" },
]);

// Selected Tier based on Simulator Qty
const activeSimTier = computed<VolumeTier>(() => {
  const qty = simQuantity.value;
  return (
    volumeTiers.value.find((t) => qty >= t.minQty && (t.maxQty === undefined || qty <= t.maxQty)) ??
    volumeTiers.value[0]!
  );
});

// Computed Simulated Values
const unitDiscountedPrice = computed(() => {
  const discount = activeSimTier.value.discountPercent / 100;
  return simBasePrice.value * (1 - discount);
});

const simGrossTotal = computed(() => {
  return unitDiscountedPrice.value * simQuantity.value;
});

const marketplaceCommission = computed(() => {
  return simGrossTotal.value * 0.12; // 12% standard platform fee
});

const sellerNetTakeHome = computed(() => {
  return simGrossTotal.value - marketplaceCommission.value;
});

// Converted Quotes in all currencies
const multiCurrencyQuotes = computed(() => {
  const baseInUsd =
    simSelectedCurrency.value === "USD"
      ? simBasePrice.value
      : simBasePrice.value / (exchangeRates.value[simSelectedCurrency.value] || 1);

  return Object.entries(exchangeRates.value).map(([curr, rate]) => {
    const convertedUnit = baseInUsd * rate * (1 - activeSimTier.value.discountPercent / 100);
    const convertedTotal = convertedUnit * simQuantity.value;
    return {
      currency: curr,
      rate,
      unitPrice: convertedUnit,
      totalPrice: convertedTotal,
    };
  });
});

const fetchCatalog = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<Product[]>("/api/v1/products");
    products.value = Array.isArray(data) ? data : [];
  } catch {
    products.value = [];
  } finally {
    isLoading.value = false;
  }
};

const fetchRates = async () => {
  try {
    const res = await api.get<{ rates?: Array<{ targetCurrency: string; exchangeRate: string | number }> }>("/api/v1/prices/currencies");
    if (res && Array.isArray(res.rates) && res.rates.length > 0) {
      const map: Record<string, number> = { USD: 1.0 };
      for (const r of res.rates) {
        if (r.targetCurrency && r.exchangeRate) {
          map[r.targetCurrency] = Number(r.exchangeRate);
        }
      }
      exchangeRates.value = map;
    }
  } catch {
    // Retain defaults if rates endpoint is unavailable
  }
};

onMounted(() => {
  void Promise.allSettled([fetchCatalog(), fetchRates()]);
});

// Quick Price Edit Modal State
const selectedProduct = ref<Product | null>(null);
const editPriceValue = ref<number>(0);
const isEditModalOpen = ref(false);

const openPriceEdit = (p: Product) => {
  selectedProduct.value = p;
  editPriceValue.value = p.price;
  isEditModalOpen.value = true;
};

const handleSavePrice = async () => {
  if (!selectedProduct.value || editPriceValue.value <= 0) {
    notify.error("Invalid Price", "Price must be a positive number.");
    return;
  }

  isUpdatingPrice.value = true;
  try {
    await api.patch(`/api/v1/products/${selectedProduct.value.id}`, {
      price: editPriceValue.value,
    });

    notify.success("Price Updated", `Successfully updated price for ${selectedProduct.value.name} to $${editPriceValue.value}.`);
    selectedProduct.value.price = editPriceValue.value;
    isEditModalOpen.value = false;
  } catch (err: any) {
    notify.error("Update Failed", err?.message || "Failed to update price.");
  } finally {
    isUpdatingPrice.value = false;
  }
};

const handleExportPricing = () => {
  const columns: CsvColumn<Product>[] = [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Product Name" },
    { key: "category", label: "Category" },
    { key: "price", label: "Base Price", formatter: (v) => `${Number(v).toFixed(2)}` },
    { key: "status", label: "Catalog Status" },
  ];
  exportToCsv("seller_pricing_schedule", columns, products.value);
};
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Pricing & Currency Workbench"
      description="Simulate volume discounts, inspect currency conversions, and manage authoritative SKU price rules."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="handleExportPricing"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
          <span>Export Price Schedule</span>
        </button>
      </template>
    </PageHeader>

    <!-- Top KPI Summary Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Active SKU Price Rules"
        :value="products.length"
        change="Synchronized with catalog"
        trend="neutral"
        icon="i-heroicons-tag"
      />
      <StatsCard
        title="Volume Tier Discount Max"
        value="15% Off"
        change="Applies to 100+ wholesale units"
        trend="up"
        icon="i-heroicons-sparkles"
      />
      <StatsCard
        title="Platform Commission Rate"
        value="12.0%"
        change="Standard marketplace tier"
        trend="neutral"
        icon="i-heroicons-scale"
      />
      <StatsCard
        title="Store Currency"
        :value="currency"
        change="Auto-converted multi-currency"
        trend="up"
        icon="i-heroicons-globe-alt"
      />
    </div>

    <!-- Pricing Simulator & Volume Tiers Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Simulator Form -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-calculator" class="h-4 w-4 text-primary-600" />
              Live Price & Quote Simulator
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Test quote breakdown with tiered volume rules.</p>
          </div>
        </div>

        <div class="space-y-4 mt-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Base Unit Price ({{ simSelectedCurrency }})
            </label>
            <input
              v-model.number="simBasePrice"
              type="number"
              min="1"
              step="any"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Order Quantity
            </label>
            <input
              v-model.number="simQuantity"
              type="number"
              min="1"
              step="1"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quote Base Currency
            </label>
            <select
              v-model="simSelectedCurrency"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          <!-- Calculated Breakdown Card -->
          <div class="p-4 rounded-xl border border-primary-500/20 bg-primary-50/50 dark:border-primary-500/30 dark:bg-primary-950/20 space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Applied Tier:</span>
              <span class="font-bold text-primary-700 dark:text-primary-300">
                {{ activeSimTier.tierName }} ({{ activeSimTier.discountPercent }}% off)
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Discounted Unit Price:</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">
                {{ simSelectedCurrency }} {{ unitDiscountedPrice.toFixed(2) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Gross Merchandise Value:</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">
                {{ simSelectedCurrency }} {{ simGrossTotal.toFixed(2) }}
              </span>
            </div>
            <div class="flex justify-between text-rose-600 dark:text-rose-400">
              <span>Platform Fee (12%):</span>
              <span class="font-mono font-bold">- {{ simSelectedCurrency }} {{ marketplaceCommission.toFixed(2) }}</span>
            </div>
            <div class="pt-2 border-t border-primary-500/20 flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <span>Seller Net Take-Home:</span>
              <span class="font-mono">{{ simSelectedCurrency }} {{ sellerNetTakeHome.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Multi-Currency Conversion Matrix -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-arrows-right-left" class="h-4 w-4 text-primary-600" />
            Global Currency Matrix
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Authoritative exchange conversions from pricing-service.</p>
        </div>

        <div class="space-y-3 mt-4">
          <div
            v-for="quote in multiCurrencyQuotes"
            :key="quote.currency"
            class="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-xs text-slate-900 dark:text-white">{{ quote.currency }}</span>
                <span class="text-[10px] text-slate-400 font-mono">Rate: {{ quote.rate }}</span>
              </div>
              <p class="text-[11px] text-slate-500 font-mono">
                Unit: {{ quote.currency }} {{ quote.unitPrice.toFixed(2) }}
              </p>
            </div>
            <div class="text-right">
              <span class="font-mono font-bold text-xs text-primary-600 dark:text-primary-400">
                {{ quote.currency }} {{ quote.totalPrice.toFixed(2) }}
              </span>
              <p class="text-[10px] text-slate-400">Total for {{ simQuantity }} units</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Volume Tier Hierarchy -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-layer-group" class="h-4 w-4 text-primary-600" />
            Configured Volume Tiers
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Active automated discount thresholds for your storefront.</p>
        </div>

        <div class="space-y-3 mt-4">
          <div
            v-for="(tier, idx) in volumeTiers"
            :key="idx"
            :class="[
              'p-3.5 rounded-xl border transition-all text-xs',
              activeSimTier.tierName === tier.tierName
                ? 'border-primary-500/50 bg-primary-50/40 dark:border-primary-500/40 dark:bg-primary-950/20'
                : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30',
            ]"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-900 dark:text-white">{{ tier.tierName }}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {{ tier.discountPercent }}% Discount
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 font-mono">
              Threshold: {{ tier.minQty }} {{ tier.maxQty ? `to ${tier.maxQty}` : "+" }} units
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Catalog SKU Price Table -->
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            SKU Authoritative Base Prices
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Click edit on any SKU to adjust base pricing and update live checkout quotes.
          </p>
        </div>
      </div>

      <div v-if="isLoading" class="py-12 flex justify-center">
        <LoadingSpinner size="lg" label="Loading catalog pricing..." />
      </div>

      <div v-else-if="products.length === 0" class="py-6">
        <EmptyState
          title="No Products in Catalog"
          description="Your catalog has no active SKUs yet. Create your first product to configure volume tiers and live pricing schedules."
          icon="i-heroicons-tag"
        >
          <template #action>
            <NuxtLink
              to="/products/create"
              class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition"
            >
              <UIcon name="i-heroicons-plus" class="h-4 w-4" />
              <span>Create Product</span>
            </NuxtLink>
          </template>
        </EmptyState>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th class="py-3 px-4 font-semibold">SKU Code</th>
              <th class="py-3 px-4 font-semibold">Product Title</th>
              <th class="py-3 px-4 font-semibold">Category</th>
              <th class="py-3 px-4 font-semibold">Base Price</th>
              <th class="py-3 px-4 font-semibold">Estimated Net Margin</th>
              <th class="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr
              v-for="p in products"
              :key="p.id"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td class="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                {{ p.sku }}
              </td>
              <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                {{ p.name }}
              </td>
              <td class="py-3 px-4 text-slate-500">
                {{ p.category || "General" }}
              </td>
              <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ${{ Number(p.price).toFixed(2) }}
              </td>
              <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                ${{ (p.price * 0.88).toFixed(2) }} <span class="text-[10px] text-slate-400">(88%)</span>
              </td>
              <td class="py-3 px-4 text-right">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800 transition"
                  @click="openPriceEdit(p)"
                >
                  Adjust Price
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Price Adjustment Modal -->
    <div
      v-if="isEditModalOpen && selectedProduct"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
    >
      <div class="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-tag" class="h-4 w-4 text-primary-600" />
          Adjust SKU Price: {{ selectedProduct.sku }}
        </h3>
        <p class="text-xs text-slate-500 mt-1 truncate">
          {{ selectedProduct.name }}
        </p>

        <div class="my-5 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Base Price ($ USD)
            </label>
            <input
              v-model.number="editPriceValue"
              type="number"
              min="0.01"
              step="0.01"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-500">Platform Fee (12%):</span>
              <span class="font-mono text-rose-500">-${{ (editPriceValue * 0.12).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
              <span>Net Take-Home:</span>
              <span class="font-mono">${{ (editPriceValue * 0.88).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            @click="isEditModalOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="isUpdatingPrice"
            class="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-xs font-bold text-white shadow-xs transition"
            @click="handleSavePrice"
          >
            <UIcon v-if="isUpdatingPrice" name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
            <span>Save & Deploy Price</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
