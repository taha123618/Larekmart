<script setup lang="ts">
import { ref, computed } from "vue";
import { useUIStore } from "~/stores/ui.store";
import { useAuthStore } from "~/stores/auth.store";
import { useRoute } from "vue-router";

const uiStore = useUIStore();
const authStore = useAuthStore();
const route = useRoute();
const colorMode = useColorMode();

const isProfileMenuOpen = ref(false);
const notificationsCount = ref(3);

const breadcrumb = computed(() => {
  const parts = route.path.split("/").filter(Boolean);
  if (parts.length === 0) return "Dashboard";
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" / ");
});

const toggleTheme = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};

const handleSignOut = async () => {
  isProfileMenuOpen.value = false;
  await authStore.signOut();
};
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-slate-800 dark:bg-slate-900/95"
  >
    <!-- Left Section: Mobile Hamburger + Breadcrumb -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Open sidebar"
        @click="uiStore.toggleMobileMenu()"
      >
        <UIcon name="i-heroicons-bars-3" class="h-6 w-6" />
      </button>

      <div class="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <UIcon name="i-heroicons-home" class="h-4 w-4" />
        <span>/</span>
        <span class="font-medium text-slate-900 dark:text-white">{{ breadcrumb }}</span>
      </div>
    </div>

    <!-- Center Section: Quick Search -->
    <div class="hidden md:flex flex-1 max-w-md mx-6">
      <div class="relative w-full">
        <UIcon
          name="i-heroicons-magnifying-glass"
          class="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
        />
        <input
          v-model="uiStore.activeSearchQuery"
          type="search"
          placeholder="Search products, orders, customers..."
          class="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 transition focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500 dark:focus:bg-slate-900"
        />
      </div>
    </div>

    <!-- Right Section: Actions + Profile -->
    <div class="flex items-center gap-2 sm:gap-3">
      <!-- Platform Health Live Badge -->
      <div
        class="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
        title="Larekmart core commerce engine & API gateways verified operational"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>All Systems Operational</span>
      </div>

      <!-- Theme Toggle -->
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        :aria-label="colorMode.value === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        @click="toggleTheme"
      >
        <UIcon
          :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          class="h-5 w-5"
        />
      </button>

      <!-- Notification Bell -->
      <div class="relative">
        <NuxtLink
          to="/support"
          class="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="View notifications"
        >
          <UIcon name="i-heroicons-bell" class="h-5 w-5" />
          <span
            v-if="notificationsCount > 0"
            class="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"
          />
        </NuxtLink>
      </div>

      <!-- Separator -->
      <div class="h-6 w-px bg-slate-200 dark:bg-slate-800" />

      <!-- User Profile Menu -->
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg p-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="isProfileMenuOpen = !isProfileMenuOpen"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 font-bold text-xs text-white"
          >
            {{ authStore.currentUser?.firstName?.charAt(0) || "S" }}
          </div>
          <div class="hidden text-left xl:block">
            <p class="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              {{ authStore.currentUser?.fullName || "Seller Partner" }}
            </p>
            <p class="text-[10px] text-slate-500 dark:text-slate-400">
              Verified Merchant
            </p>
          </div>
          <UIcon
            name="i-heroicons-chevron-down"
            class="hidden h-3.5 w-3.5 text-slate-400 xl:block"
          />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="isProfileMenuOpen"
          class="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p class="text-xs font-semibold text-slate-900 dark:text-white">
              {{ authStore.currentUser?.fullName || "Seller Account" }}
            </p>
            <p class="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {{ authStore.currentUser?.email || "seller@larekmart.com" }}
            </p>
          </div>

          <div class="mt-1 space-y-0.5">
            <NuxtLink
              to="/settings"
              class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="isProfileMenuOpen = false"
            >
              <UIcon name="i-heroicons-cog-6-tooth" class="h-4 w-4" />
              Settings
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="isProfileMenuOpen = false"
            >
              <UIcon name="i-heroicons-lifebuoy" class="h-4 w-4" />
              Help & Support
            </NuxtLink>
          </div>

          <div class="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              @click="handleSignOut"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
