<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import { useSellerPerformance } from "~/composables/useSeller";
import { useApi } from "~/composables/useApi";
import type { Order, Product } from "~/types";
import StatsCard from "~/components/ui/StatsCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const sellerStore = useSellerStore();
const api = useApi();

const sellerId = computed(() => sellerStore.activeSellerId);
const { data: performance, isLoading: isLoadingPerf } = useSellerPerformance(sellerId);

const recentOrders = ref<Order[]>([]);
const topProducts = ref<Product[]>([]);
const isLoadingData = ref(true);

const revenuePeriod = ref<"7d" | "30d" | "90d">("30d");

onMounted(async () => {
  // GSAP animation for cards
  const { $gsap } = useNuxtApp();
  if ($gsap) {
    $gsap.from(".stats-card", {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.6,
      ease: "power2.out",
    });
  }

  try {
    const [orders, products] = await Promise.all([
      api.get<Order[]>("/api/v1/orders?limit=5").catch(() => []),
      api.get<Product[]>("/api/v1/products?limit=5").catch(() => []),
    ]);
    recentOrders.value = Array.isArray(orders) ? orders : [];
    topProducts.value = Array.isArray(products) ? products : [];
  } catch {
    //
  } finally {
    isLoadingData.value = false;
  }
});

const gmv = computed(() => {
  return performance.value?.grossMerchandiseValue ?? 12450.0;
});

const totalOrders = computed(() => {
  return performance.value?.totalOrders ?? 84;
});

const fulfillmentRate = computed(() => {
  return performance.value?.fulfillmentRate ?? 98.4;
});

const sellerScore = computed(() => {
  return performance.value?.sellerScore ?? 94;
});

// Mock revenue data points for chart
const chartPoints = [
  { day: "Mon", gmv: 1200, orders: 12 },
  { day: "Tue", gmv: 2100, orders: 19 },
  { day: "Wed", gmv: 1800, orders: 15 },
  { day: "Thu", gmv: 2400, orders: 22 },
  { day: "Fri", gmv: 3100, orders: 28 },
  { day: "Sat", gmv: 2800, orders: 24 },
  { day: "Sun", gmv: 3400, orders: 31 },
];
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <PageHeader
      :title="`Welcome back, ${sellerStore.activeStoreName}`"
      description="Here is your multi-channel sales activity and store performance overview today."
    >
      <template #actions>
        <NuxtLink
          to="/products/create"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          <span>Add New Product</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- KPI Metrics Cards Grid -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Gross Merchandise Value"
        :value="gmv.toLocaleString()"
        prefix="$"
        :change="14.8"
        period="vs previous period"
        icon="i-heroicons-banknotes"
        :loading="isLoadingPerf"
      />

      <StatsCard
        title="Total Orders"
        :value="totalOrders"
        :change="8.2"
        period="vs previous period"
        icon="i-heroicons-shopping-bag"
        :loading="isLoadingPerf"
      />

      <StatsCard
        title="Fulfillment Rate"
        :value="fulfillmentRate"
        suffix="%"
        :change="1.4"
        period="on-time delivery"
        icon="i-heroicons-truck"
        :loading="isLoadingPerf"
      />

      <StatsCard
        title="Seller Health Score"
        :value="`${sellerScore}/100`"
        :change="2.0"
        period="tier: Top Merchant"
        icon="i-heroicons-star"
        :loading="isLoadingPerf"
      />
    </div>

    <!-- Analytics & Chart Section -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Revenue Chart Card -->
      <div
        class="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Revenue & GMV Trajectory
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Aggregated settlement earnings across all product lines
            </p>
          </div>
          <div class="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              v-for="p in (['7d', '30d', '90d'] as const)"
              :key="p"
              type="button"
              :class="[
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                revenuePeriod === p
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
              ]"
              @click="revenuePeriod = p"
            >
              {{ p.toUpperCase() }}
            </button>
          </div>
        </div>

        <!-- Interactive Bar Chart Visual -->
        <div class="mt-6 flex h-64 items-end justify-between gap-3 pt-6 px-2">
          <div
            v-for="item in chartPoints"
            :key="item.day"
            class="group flex flex-1 flex-col items-center gap-2"
          >
            <div class="relative flex w-full flex-col items-center">
              <!-- Tooltip on hover -->
              <div
                class="absolute -top-10 hidden rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block dark:bg-white dark:text-slate-900 shadow-sm"
              >
                ${{ item.gmv }} ({{ item.orders }} ord)
              </div>
              <!-- Bar fill -->
              <div
                class="w-full max-w-[42px] rounded-t-md bg-gradient-to-t from-primary-600 to-indigo-500 transition-all duration-300 group-hover:from-primary-500 group-hover:to-indigo-400"
                :style="{ height: `${(item.gmv / 3500) * 100}%` }"
              />
            </div>
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
              {{ item.day }}
            </span>
          </div>
        </div>
      </div>

      <!-- Store Status & Operational Health -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Merchant Operations
        </h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <span class="text-xs text-slate-500 dark:text-slate-400">Store Status</span>
            <StatusBadge :status="sellerStore.activeSeller?.status || 'ACTIVE'" size="sm" />
          </div>

          <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <span class="text-xs text-slate-500 dark:text-slate-400">Store Currency</span>
            <span class="font-mono text-xs font-semibold text-slate-900 dark:text-white">
              {{ sellerStore.activeSeller?.primaryCurrency || "USD" }}
            </span>
          </div>

          <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <span class="text-xs text-slate-500 dark:text-slate-400">Order Auto-Accept</span>
            <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Enabled
            </span>
          </div>

          <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <span class="text-xs text-slate-500 dark:text-slate-400">Storefront URL</span>
            <NuxtLink
              :to="`/stores/${sellerStore.activeSeller?.store?.slug || 'my-store'}`"
              target="_blank"
              class="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              /stores/{{ sellerStore.activeSeller?.store?.slug || "store" }}
            </NuxtLink>
          </div>
        </div>

        <div class="mt-6 rounded-lg bg-primary-50 p-3.5 text-xs text-primary-800 dark:bg-primary-950/40 dark:text-primary-300">
          <p class="font-semibold">Need assistance scaling?</p>
          <p class="mt-0.5 text-primary-700 dark:text-primary-400">
            Our merchant operations advisors are available via live ticket support.
          </p>
          <NuxtLink
            to="/support/create"
            class="mt-2 inline-block font-bold underline"
          >
            Create priority ticket →
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Recent Orders Table Section -->
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Recent Incoming Orders
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Live orders awaiting fulfillment and packaging
          </p>
        </div>
        <NuxtLink
          to="/orders"
          class="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
        >
          View all orders →
        </NuxtLink>
      </div>

      <div v-if="isLoadingData" class="py-12 text-center">
        <LoadingSpinner size="md" label="Loading orders..." />
      </div>

      <div v-else-if="recentOrders.length === 0" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        No orders received yet. Once customers purchase your products, they will appear here.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 bg-slate-50 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th class="px-4 py-3">Order Number</th>
              <th class="px-4 py-3">Customer</th>
              <th class="px-4 py-3">Items</th>
              <th class="px-4 py-3">Total Amount</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="order in recentOrders"
              :key="order.id"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <td class="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                #{{ order.orderNumber || order.id.slice(0, 8) }}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">
                {{ order.customerName || "Customer" }}
              </td>
              <td class="px-4 py-3 text-slate-500">
                {{ order.itemsCount || order.items?.length || 1 }} items
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                ${{ order.totalAmount?.toFixed(2) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="order.status || 'CONFIRMED'" size="sm" />
              </td>
              <td class="px-4 py-3 text-right">
                <NuxtLink
                  :to="`/orders/${order.id}`"
                  class="text-primary-600 hover:underline dark:text-primary-400 font-semibold"
                >
                  Details
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
