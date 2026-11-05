<script setup lang="ts">
import { ref } from "vue";
import { useSellerStore } from "~/stores/seller.store";
import StatusBadge from "~/components/ui/StatusBadge.vue";

const sellerStore = useSellerStore();
const isOpen = ref(false);

const selectSeller = (sellerId: string) => {
  sellerStore.setActiveSeller(sellerId);
  isOpen.value = false;
};
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/60"
      @click="isOpen = !isOpen"
    >
      <div class="flex items-center gap-2.5 truncate">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 font-bold text-white text-xs"
        >
          {{ sellerStore.activeStoreName.charAt(0).toUpperCase() }}
        </div>
        <div class="truncate">
          <p class="truncate font-semibold text-xs text-slate-900 dark:text-white">
            {{ sellerStore.activeStoreName }}
          </p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">
            ID: {{ sellerStore.activeSeller?.id ? sellerStore.activeSeller.id.slice(0, 8) + '...' : 'No store' }}
          </p>
        </div>
      </div>
      <UIcon
        name="i-heroicons-chevron-up-down"
        class="h-4 w-4 shrink-0 text-slate-400"
      />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg z-50 dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Switch Seller Store
      </div>

      <div class="max-h-48 overflow-y-auto space-y-1">
        <button
          v-for="seller in sellerStore.sellers"
          :key="seller.id"
          type="button"
          :class="[
            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition',
            seller.id === sellerStore.activeSellerId
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          ]"
          @click="selectSeller(seller.id)"
        >
          <div class="flex items-center gap-2 truncate">
            <span class="truncate">{{ seller.store?.name || `Store #${seller.id.slice(0, 6)}` }}</span>
          </div>
          <StatusBadge :status="seller.status" size="sm" />
        </button>
      </div>

      <div class="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
        <NuxtLink
          to="/onboarding/seller"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800"
          @click="isOpen = false"
        >
          <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
          <span>Register New Store</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
