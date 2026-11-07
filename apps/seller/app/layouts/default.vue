<script setup lang="ts">
import { onMounted } from "vue";
import { useUIStore } from "~/stores/ui.store";
import { useSellerStore } from "~/stores/seller.store";
import AppSidebar from "~/components/layout/AppSidebar.vue";
import AppHeader from "~/components/layout/AppHeader.vue";

const uiStore = useUIStore();
const sellerStore = useSellerStore();

onMounted(() => {
  uiStore.initFromStorage();
  sellerStore.initFromStorage();
});
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
    <!-- Desktop Sidebar -->
    <div class="hidden lg:flex lg:shrink-0">
      <AppSidebar />
    </div>

    <!-- Mobile Drawer Overlay -->
    <div
      v-if="uiStore.isMobileMenuOpen"
      class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
      @click="uiStore.closeMobileMenu()"
    />

    <!-- Mobile Sidebar Drawer -->
    <div
      v-if="uiStore.isMobileMenuOpen"
      class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform lg:hidden dark:bg-slate-900"
    >
      <div class="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 font-bold text-white text-sm">
            LM
          </div>
          <span class="font-bold text-slate-900 dark:text-white">Seller Central</span>
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          @click="uiStore.closeMobileMenu()"
        >
          <UIcon name="i-heroicons-x-mark" class="h-6 w-6" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <AppSidebar />
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <AppHeader />

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div class="mx-auto max-w-7xl">
          <slot />
        </div>
      </main>

      <!-- Dashboard Footer -->
      <footer class="border-t border-slate-200 bg-white/50 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div class="flex items-center gap-2">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>LarekMart Seller Services Operational</span>
          </div>
          <p>© {{ new Date().getFullYear() }} LarekMart Marketplace Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  </div>
</template>
