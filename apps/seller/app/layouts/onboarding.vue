<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const colorMode = useColorMode();

const steps = [
  { id: 1, name: "Welcome", path: "/onboarding" },
  { id: 2, name: "Vendor Entity", path: "/onboarding/vendor" },
  { id: 3, name: "Store Details", path: "/onboarding/seller" },
  { id: 4, name: "Approval Status", path: "/onboarding/status" },
];

const currentStepIndex = computed(() => {
  const p = route.path;
  if (p === "/onboarding/vendor") return 2;
  if (p === "/onboarding/seller") return 3;
  if (p === "/onboarding/status") return 4;
  return 1;
});

const toggleTheme = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <!-- Onboarding Header -->
    <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 font-extrabold text-white text-lg">
            LM
          </div>
          <div>
            <h1 class="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Seller Onboarding
            </h1>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Set up your merchant presence on LarekMart
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            @click="toggleTheme"
          >
            <UIcon
              :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
              class="h-5 w-5"
            />
          </button>
        </div>
      </div>

      <!-- Step Indicators Progress Bar -->
      <div class="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/40">
        <div class="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <nav aria-label="Progress">
            <ol class="flex items-center justify-between sm:justify-start sm:gap-8">
              <li
                v-for="step in steps"
                :key="step.id"
                class="flex items-center gap-2"
              >
                <div
                  :class="[
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    step.id < currentStepIndex
                      ? 'bg-emerald-600 text-white'
                      : step.id === currentStepIndex
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                  ]"
                >
                  <UIcon
                    v-if="step.id < currentStepIndex"
                    name="i-heroicons-check"
                    class="h-4 w-4"
                  />
                  <span v-else>{{ step.id }}</span>
                </div>
                <span
                  :class="[
                    'hidden text-xs font-medium sm:inline-block',
                    step.id === currentStepIndex
                      ? 'font-semibold text-primary-600 dark:text-primary-400'
                      : 'text-slate-500 dark:text-slate-400',
                  ]"
                >
                  {{ step.name }}
                </span>
              </li>
            </ol>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Step Content -->
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <slot />
    </main>

    <!-- Onboarding Footer -->
    <footer class="mt-auto border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
      Need assistance? Contact our seller support team at merchant-support@larekmart.com
    </footer>
  </div>
</template>
