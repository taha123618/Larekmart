<script setup lang="ts">
import { computed } from "vue";

interface Props {
  title: string;
  value: string | number;
  change?: number | null;
  period?: string;
  icon?: string;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  change: null,
  period: "vs last month",
  prefix: "",
  suffix: "",
  loading: false,
});

const isPositive = computed(() => (props.change ?? 0) >= 0);
const formattedChange = computed(() => {
  if (props.change === null || props.change === undefined) return null;
  const prefix = props.change > 0 ? "+" : "";
  return `${prefix}${props.change.toFixed(1)}%`;
});
</script>

<template>
  <div
    class="stats-card relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
  >
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-4 w-24 bg-slate-200 rounded-sm dark:bg-slate-800" />
      <div class="h-8 w-36 bg-slate-200 rounded-sm dark:bg-slate-800" />
      <div class="h-4 w-20 bg-slate-200 rounded-sm dark:bg-slate-800" />
    </div>

    <div v-else class="flex flex-col justify-between h-full">
      <div class="flex items-center justify-between">
        <span
          class="text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          {{ title }}
        </span>
        <div
          v-if="icon"
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
        >
          <UIcon :name="icon" class="w-5 h-5" />
        </div>
      </div>

      <div class="mt-4 flex items-baseline gap-2">
        <span
          class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
        >
          {{ prefix }}{{ value }}{{ suffix }}
        </span>
      </div>

      <div class="mt-3 flex items-center gap-2 text-xs">
        <template v-if="formattedChange !== null">
          <span
            :class="[
              'inline-flex items-center font-semibold rounded px-1.5 py-0.5',
              isPositive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
            ]"
          >
            <UIcon
              :name="
                isPositive
                  ? 'i-heroicons-arrow-trending-up'
                  : 'i-heroicons-arrow-trending-down'
              "
              class="w-3.5 h-3.5 mr-1"
            />
            {{ formattedChange }}
          </span>
          <span class="text-slate-500 dark:text-slate-400">{{ period }}</span>
        </template>
      </div>

      <!-- Sparkline or extra slot -->
      <div v-if="$slots.sparkline" class="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        <slot name="sparkline" />
      </div>
    </div>
  </div>
</template>
