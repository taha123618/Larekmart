<script setup lang="ts">
const colorMode = useColorMode();

const toggleTheme = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};
</script>

<template>
  <div class="relative flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8 dark:bg-slate-950">
    <!-- Top Bar with Theme Toggle -->
    <div class="absolute top-4 right-4 sm:top-6 sm:right-6">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Toggle theme"
        @click="toggleTheme"
      >
        <UIcon
          :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          class="h-5 w-5"
        />
      </button>
    </div>

    <!-- Brand Header -->
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <NuxtLink to="/" class="inline-flex items-center gap-2.5">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 shadow-md shadow-primary-500/25">
          <span class="font-extrabold text-white text-xl">LM</span>
        </div>
        <span class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          LarekMart
        </span>
      </NuxtLink>
    </div>

    <!-- Centered Card Slot -->
    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <slot />
    </div>

    <!-- Footer -->
    <div class="mt-12 text-center text-xs text-slate-400 dark:text-slate-600">
      <p>© {{ new Date().getFullYear() }} LarekMart Marketplace. Secure Merchant Portal.</p>
    </div>
  </div>
</template>
