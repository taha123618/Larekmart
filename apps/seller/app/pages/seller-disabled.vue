<script setup lang="ts">
definePageMeta({
  layout: "auth",
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
      <UIcon name="i-heroicons-exclamation-triangle" class="h-7 w-7" />
    </div>

    <h2 class="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
      Seller Access Temporarily Unavailable
    </h2>
    <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
      The marketplace operator has currently disabled merchant self-service portal access for scheduled maintenance or policy updates.
    </p>

    <div class="mt-6 flex flex-col gap-2">
      <NuxtLink
        to="/login"
        class="inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Return to Login
      </NuxtLink>
      <a
        href="mailto:support@larekmart.com"
        class="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        Contact Platform Support
      </a>
    </div>
  </div>
</template>
