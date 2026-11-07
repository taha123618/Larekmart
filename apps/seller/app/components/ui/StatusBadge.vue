<script setup lang="ts">
import { computed } from "vue";

interface Props {
  status: string;
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
});

const formattedStatus = computed(() => {
  return props.status.replace(/_/g, " ").toUpperCase();
});

const badgeStyle = computed(() => {
  const s = props.status.toUpperCase();
  switch (s) {
    case "ACTIVE":
    case "VERIFIED":
    case "DELIVERED":
    case "COMPLETED":
    case "IN_STOCK":
    case "RESOLVED":
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    case "PENDING":
    case "PENDING_VERIFICATION":
    case "PROCESSING":
    case "CONFIRMED":
    case "ONBOARDING":
    case "LOW_STOCK":
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
    case "SUSPENDED":
    case "REJECTED":
    case "CANCELLED":
    case "OUT_OF_STOCK":
    case "FAILED":
    case "URGENT":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
    case "INACTIVE":
    case "DRAFT":
    case "ARCHIVED":
    case "CLOSED":
    case "VACATION":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700";
  }
});

const sizeStyle = computed(() => {
  switch (props.size) {
    case "sm":
      return "text-xs px-2 py-0.5";
    case "lg":
      return "text-sm px-3 py-1";
    case "md":
    default:
      return "text-xs px-2.5 py-0.5";
  }
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-medium rounded-full border transition-colors',
      badgeStyle,
      sizeStyle,
    ]"
  >
    <span
      class="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"
      aria-hidden="true"
    />
    {{ formattedStatus }}
  </span>
</template>
