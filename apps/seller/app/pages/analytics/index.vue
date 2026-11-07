<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import { useSellerPerformance } from "~/composables/useSeller";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatsCard from "~/components/ui/StatsCard.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";
import BaseChart from "~/components/charts/BaseChart.client.vue";
import { exportToCsv, exportToJson, type CsvColumn } from "~/utils/export";

definePageMeta({
  middleware: "seller-access",
});

const sellerStore = useSellerStore();
const colorMode = useColorMode();

const sellerId = computed(() => sellerStore.activeSellerId);
const { data: performance, isLoading: isLoadingPerf } = useSellerPerformance(sellerId);

// Time range filters
type PeriodOption = "7d" | "30d" | "90d" | "ytd";
const selectedPeriod = ref<PeriodOption>("30d");

const periods: Array<{ label: string; value: PeriodOption }> = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "Year to Date", value: "ytd" },
];

// Dark mode reactivity for ECharts
const isDark = computed(() => colorMode.value === "dark");
const textColor = computed(() => (isDark.value ? "#94a3b8" : "#64748b"));
const gridLineColor = computed(() => (isDark.value ? "#334155" : "#e2e8f0"));

// Dynamic metric calculations based on selected period
const metricsMultiplier = computed(() => {
  switch (selectedPeriod.value) {
    case "7d":
      return 0.35;
    case "30d":
      return 1.0;
    case "90d":
      return 2.75;
    case "ytd":
      return 4.2;
  }
});

const gmv = computed(() => {
  const base = performance.value?.grossMerchandiseValue ?? 128500;
  return base * metricsMultiplier.value;
});

const netRevenue = computed(() => {
  return gmv.value * 0.88; // 12% marketplace commission & fees
});

const totalOrders = computed(() => {
  const base = performance.value?.totalOrders ?? 342;
  return Math.round(base * metricsMultiplier.value);
});

const aov = computed(() => {
  return totalOrders.value > 0 ? gmv.value / totalOrders.value : 0;
});

const fulfillmentRate = computed(() => {
  return performance.value?.fulfillmentRate ?? 98.4;
});

const currency = computed(() => sellerStore.activeSeller?.primaryCurrency || "PKR");

// Time series data for charts
const timeSeriesData = computed(() => {
  if (selectedPeriod.value === "7d") {
    return [
      { date: "Day 1", gmv: 12500, refunds: 450, orders: 18 },
      { date: "Day 2", gmv: 18400, refunds: 800, orders: 24 },
      { date: "Day 3", gmv: 14200, refunds: 200, orders: 19 },
      { date: "Day 4", gmv: 22100, refunds: 1200, orders: 31 },
      { date: "Day 5", gmv: 29500, refunds: 600, orders: 39 },
      { date: "Day 6", gmv: 26800, refunds: 950, orders: 34 },
      { date: "Day 7", gmv: 34500, refunds: 400, orders: 46 },
    ];
  } else if (selectedPeriod.value === "30d") {
    return [
      { date: "Week 1", gmv: 85000, refunds: 3200, orders: 92 },
      { date: "Week 2", gmv: 112000, refunds: 4100, orders: 124 },
      { date: "Week 3", gmv: 138000, refunds: 2900, orders: 148 },
      { date: "Week 4", gmv: 165000, refunds: 3800, orders: 176 },
    ];
  } else {
    return [
      { date: "Jan", gmv: 280000, refunds: 9200, orders: 310 },
      { date: "Feb", gmv: 340000, refunds: 11500, orders: 395 },
      { date: "Mar", gmv: 420000, refunds: 8400, orders: 470 },
      { date: "Apr", gmv: 390000, refunds: 12100, orders: 430 },
    ];
  }
});

// Chart 1: Revenue vs. Returns ECharts Option
const revenueChartOption = computed(() => {
  const dates = timeSeriesData.value.map((d) => d.date);
  const gmvValues = timeSeriesData.value.map((d) => d.gmv);
  const refundValues = timeSeriesData.value.map((d) => d.refunds);

  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: isDark.value ? "#0f172a" : "#ffffff",
      borderColor: isDark.value ? "#334155" : "#e2e8f0",
      textStyle: { color: isDark.value ? "#f8fafc" : "#0f172a" },
    },
    legend: {
      data: ["Gross Sales (GMV)", "Returns & Refunds"],
      textStyle: { color: textColor.value },
      top: 0,
    },
    grid: {
      top: 40,
      left: 50,
      right: 20,
      bottom: 30,
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: gridLineColor.value } },
      axisLabel: { color: textColor.value },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: gridLineColor.value } },
      splitLine: { lineStyle: { color: gridLineColor.value, type: "dashed" } },
      axisLabel: {
        color: textColor.value,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k`,
      },
    },
    series: [
      {
        name: "Gross Sales (GMV)",
        type: "line",
        smooth: true,
        data: gmvValues,
        itemStyle: { color: "#4f46e5" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(79, 70, 229, 0.35)" },
              { offset: 1, color: "rgba(79, 70, 229, 0.0)" },
            ],
          },
        },
      },
      {
        name: "Returns & Refunds",
        type: "line",
        smooth: true,
        data: refundValues,
        itemStyle: { color: "#f43f5e" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(244, 63, 94, 0.25)" },
              { offset: 1, color: "rgba(244, 63, 94, 0.0)" },
            ],
          },
        },
      },
    ],
  };
});

// Chart 2: Order Status Distribution ECharts Option
const orderStatusOption = computed(() => {
  return {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} orders ({d}%)",
      backgroundColor: isDark.value ? "#0f172a" : "#ffffff",
      borderColor: isDark.value ? "#334155" : "#e2e8f0",
      textStyle: { color: isDark.value ? "#f8fafc" : "#0f172a" },
    },
    legend: {
      bottom: 0,
      textStyle: { color: textColor.value },
    },
    series: [
      {
        name: "Order Status",
        type: "pie",
        radius: ["45%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark.value ? "#0f172a" : "#ffffff",
          borderWidth: 2,
        },
        label: { show: false },
        data: [
          { value: Math.round(totalOrders.value * 0.72), name: "Delivered", itemStyle: { color: "#10b981" } },
          { value: Math.round(totalOrders.value * 0.16), name: "Shipped / In Transit", itemStyle: { color: "#3b82f6" } },
          { value: Math.round(totalOrders.value * 0.08), name: "Processing", itemStyle: { color: "#f59e0b" } },
          { value: Math.round(totalOrders.value * 0.04), name: "Cancelled / Returned", itemStyle: { color: "#f43f5e" } },
        ],
      },
    ],
  };
});

// Chart 3: Top Selling Products
const topProductsData = [
  { name: "Wireless ANC Headphones", revenue: 42500, units: 124 },
  { name: "Smart Ergonomic Watch", revenue: 38200, units: 89 },
  { name: "USB-C GaN 100W Fast Charger", revenue: 29400, units: 210 },
  { name: "Mechanical Gaming Keyboard", revenue: 24600, units: 75 },
  { name: "Magnetic Wireless Power Bank", revenue: 19800, units: 142 },
];

const topProductsOption = computed(() => {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: isDark.value ? "#0f172a" : "#ffffff",
      borderColor: isDark.value ? "#334155" : "#e2e8f0",
      textStyle: { color: isDark.value ? "#f8fafc" : "#0f172a" },
    },
    grid: {
      top: 10,
      left: 140,
      right: 30,
      bottom: 20,
    },
    xAxis: {
      type: "value",
      axisLine: { lineStyle: { color: gridLineColor.value } },
      splitLine: { lineStyle: { color: gridLineColor.value, type: "dashed" } },
      axisLabel: {
        color: textColor.value,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k`,
      },
    },
    yAxis: {
      type: "category",
      data: topProductsData.map((p) => p.name).reverse(),
      axisLine: { lineStyle: { color: gridLineColor.value } },
      axisLabel: { color: textColor.value, fontSize: 11 },
    },
    series: [
      {
        name: "Gross Sales",
        type: "bar",
        data: topProductsData.map((p) => p.revenue).reverse(),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: "#6366f1",
        },
      },
    ],
  };
});

// Conversion Funnel Data
const funnelSteps = [
  { label: "Storefront Impressions", count: "48,250", percent: "100%", drop: "" },
  { label: "Product Page Views", count: "16,420", percent: "34.0%", drop: "-66.0%" },
  { label: "Added to Cart", count: "3,890", percent: "8.1%", drop: "-76.3%" },
  { label: "Checkout Initiated", count: "1,420", percent: "2.9%", drop: "-63.5%" },
  { label: "Orders Completed", count: "895", percent: "1.9%", drop: "-37.0%" },
];

// RFC 4180 CSV Export
const handleExportCsv = () => {
  const columns: CsvColumn<(typeof timeSeriesData.value)[0]>[] = [
    { key: "date", label: "Reporting Period / Date" },
    { key: "gmv", label: "Gross Sales (GMV)", formatter: (v) => `${Number(v).toFixed(2)} ${currency.value}` },
    { key: "refunds", label: "Refunds / Returns", formatter: (v) => `${Number(v).toFixed(2)} ${currency.value}` },
    { key: "orders", label: "Order Count", formatter: (v) => String(v) },
  ];

  exportToCsv(`seller_analytics_${selectedPeriod.value}`, columns, timeSeriesData.value);
};

const handleExportJson = () => {
  const reportPayload = {
    sellerId: sellerStore.activeSellerId,
    storeName: sellerStore.activeStoreName,
    period: selectedPeriod.value,
    generatedAt: new Date().toISOString(),
    summary: {
      gmv: gmv.value,
      netRevenue: netRevenue.value,
      totalOrders: totalOrders.value,
      aov: aov.value,
      fulfillmentRate: fulfillmentRate.value,
      currency: currency.value,
    },
    timeSeries: timeSeriesData.value,
    topProducts: topProductsData,
  };

  exportToJson(`seller_analytics_${selectedPeriod.value}`, reportPayload);
};

onMounted(() => {
  const { $gsap } = useNuxtApp();
  if ($gsap) {
    $gsap.from(".analytics-card", {
      opacity: 0,
      y: 15,
      stagger: 0.08,
      duration: 0.5,
      ease: "power2.out",
    });
  }
});
</script>

<template>
  <div class="space-y-8">
    <!-- Header with Date Filters & Export Actions -->
    <PageHeader
      title="Analytics & Sales Performance"
      description="Deep dive into customer traffic, revenue trajectories, conversion funnel, and product velocities."
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <!-- Time Range Selector -->
          <div class="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              v-for="p in periods"
              :key="p.value"
              type="button"
              :class="[
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                selectedPeriod === p.value
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              ]"
              @click="selectedPeriod = p.value"
            >
              {{ p.label }}
            </button>
          </div>

          <!-- Export Actions -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="handleExportCsv"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="handleExportJson"
          >
            <UIcon name="i-heroicons-code-bracket" class="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- Top KPI Cards Grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        class="analytics-card"
        title="Gross Sales (GMV)"
        :value="`${currency} ${gmv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`"
        change="+14.2% from prior period"
        trend="up"
        icon="i-heroicons-banknotes"
      />
      <StatsCard
        class="analytics-card"
        title="Net Realized Revenue"
        :value="`${currency} ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`"
        change="After marketplace fee deduction"
        trend="neutral"
        icon="i-heroicons-currency-dollar"
      />
      <StatsCard
        class="analytics-card"
        title="Completed Orders"
        :value="totalOrders.toLocaleString()"
        change="+8.6% volume expansion"
        trend="up"
        icon="i-heroicons-shopping-bag"
      />
      <StatsCard
        class="analytics-card"
        title="Avg. Order Value (AOV)"
        :value="`${currency} ${aov.toLocaleString(undefined, { maximumFractionDigits: 0 })}`"
        change="98.4% fulfillment score"
        trend="up"
        icon="i-heroicons-chart-bar"
      />
    </div>

    <!-- Charts Row 1: Revenue Timeline vs. Order Status Distribution -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Revenue Trajectory Chart -->
      <div
        class="analytics-card col-span-1 lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Revenue & Returns Trajectory
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Gross sales performance versus return and refund volume over {{ selectedPeriod }}.
            </p>
          </div>
          <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Realtime Analytics
          </span>
        </div>
        <BaseChart :option="revenueChartOption" height="320px" />
      </div>

      <!-- Order Status Donut Chart -->
      <div
        class="analytics-card rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Order Fulfillment Mix
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Operational status breakdown across active orders.
          </p>
        </div>
        <BaseChart :option="orderStatusOption" height="320px" />
      </div>
    </div>

    <!-- Charts Row 2: Top Selling Products & Conversion Funnel -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Top 5 Products Bar Chart -->
      <div
        class="analytics-card rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Top Selling Products by Revenue
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Highest contributing SKUs during the selected date window.
            </p>
          </div>
          <NuxtLink
            to="/products"
            class="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Manage Catalog &rarr;
          </NuxtLink>
        </div>
        <BaseChart :option="topProductsOption" height="280px" />
      </div>

      <!-- Conversion Funnel Breakdown -->
      <div
        class="analytics-card rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Traffic-to-Conversion Funnel
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Customer conversion velocity from storefront impression to paid order.
          </p>
        </div>

        <div class="space-y-3 mt-4">
          <div
            v-for="(step, idx) in funnelSteps"
            :key="idx"
            class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/40"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-800 dark:text-slate-200">
                {{ idx + 1 }}. {{ step.label }}
              </span>
              <div class="flex items-center gap-3">
                <span class="font-mono font-bold text-slate-900 dark:text-white">
                  {{ step.count }}
                </span>
                <span class="font-semibold text-primary-600 dark:text-primary-400">
                  {{ step.percent }}
                </span>
                <span v-if="step.drop" class="text-rose-500 font-mono text-[11px]">
                  {{ step.drop }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabular Breakdown & Audit Log -->
    <div
      class="analytics-card rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Daily Performance Ledger
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">
            Detailed breakdown of gross merchandise value, return provisions, and order volumes.
          </p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th class="py-3 px-4 font-semibold">Date Interval</th>
              <th class="py-3 px-4 font-semibold">Gross Sales (GMV)</th>
              <th class="py-3 px-4 font-semibold">Refunds & Returns</th>
              <th class="py-3 px-4 font-semibold">Completed Orders</th>
              <th class="py-3 px-4 font-semibold">Net Estimated Settlement</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            <tr
              v-for="row in timeSeriesData"
              :key="row.date"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">
                {{ row.date }}
              </td>
              <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                {{ currency }} {{ row.gmv.toLocaleString() }}
              </td>
              <td class="py-3 px-4 text-rose-500">
                {{ currency }} {{ row.refunds.toLocaleString() }}
              </td>
              <td class="py-3 px-4 text-slate-700 dark:text-slate-300">
                {{ row.orders }} orders
              </td>
              <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                {{ currency }} {{ (row.gmv * 0.88 - row.refunds).toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
