<script setup lang="ts">
interface Props {
  icon?: string;
  title: string;
  description: string;
}

withDefaults(defineProps<Props>(), {
  icon: "i-heroicons-inbox",
});
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-800"
  >
    <div
      class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    >
      <UIcon :name="icon" class="h-7 w-7" />
    </div>
    <h3 class="mt-4 text-base font-semibold text-slate-900 dark:text-white">
      {{ title }}
    </h3>
    <p class="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-6">
      <slot name="action" />
    </div>
  </div>
</template>
