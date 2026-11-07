<script setup lang="ts">
interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  label: "Loading...",
  color: "text-primary-600 dark:text-primary-400",
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-4 h-4";
    case "lg":
      return "w-8 h-8";
    case "xl":
      return "w-12 h-12";
    case "md":
    default:
      return "w-6 h-6";
  }
});
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="flex flex-col items-center justify-center gap-2"
  >
    <svg
      :class="['animate-spin', sizeClasses, color]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <span v-if="label" class="sr-only">{{ label }}</span>
  </div>
</template>
