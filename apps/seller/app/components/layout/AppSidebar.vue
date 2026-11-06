<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useUIStore } from "~/stores/ui.store";
import SellerSwitcher from "./SellerSwitcher.vue";

const uiStore = useUIStore();
const route = useRoute();

interface NavItem {
  label: string;
  to: string;
  icon: string;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "i-heroicons-squares-2x2" },
  { label: "Products", to: "/products", icon: "i-heroicons-cube" },
  { label: "Inventory", to: "/inventory", icon: "i-heroicons-circle-stack" },
  { label: "Orders", to: "/orders", icon: "i-heroicons-shopping-bag" },
  { label: "Finance", to: "/finance", icon: "i-heroicons-banknotes" },
  { label: "Marketing", to: "/marketing", icon: "i-heroicons-ticket" },
  { label: "Reviews", to: "/reviews", icon: "i-heroicons-star" },
  { label: "Account Health", to: "/account-health", icon: "i-heroicons-shield-check" },
  { label: "Messages", to: "/chat", icon: "i-heroicons-chat-bubble-left-right" },
  { label: "Support", to: "/support", icon: "i-heroicons-lifebuoy" },
  { label: "Settings", to: "/settings", icon: "i-heroicons-cog-6-tooth" },
];

const isCollapsed = computed(() => uiStore.isSidebarCollapsed);

const isActive = (to: string) => {
  if (to === "/dashboard") {
    return route.path === "/dashboard" || route.path === "/";
  }
  return route.path.startsWith(to);
};
</script>

<template>
  <aside
    :class="[
      'relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
      isCollapsed ? 'w-20' : 'w-64',
    ]"
  >
    <!-- Brand Logo Section -->
    <div
      class="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800"
    >
      <NuxtLink to="/dashboard" class="flex items-center gap-3 overflow-hidden">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 shadow-sm shadow-primary-500/20"
        >
          <span class="font-extrabold text-white text-lg">LM</span>
        </div>
        <div v-if="!isCollapsed" class="truncate">
          <span class="font-bold text-slate-900 dark:text-white text-sm">
            LarekMart
          </span>
          <span
            class="block text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400"
          >
            Seller Central
          </span>
        </div>
      </NuxtLink>

      <!-- Collapse Toggle Button (Desktop) -->
      <button
        type="button"
        class="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:flex dark:hover:bg-slate-800 dark:hover:text-slate-200"
        :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="uiStore.toggleSidebar()"
      >
        <UIcon
          :name="
            isCollapsed
              ? 'i-heroicons-chevron-double-right'
              : 'i-heroicons-chevron-double-left'
          "
          class="h-4 w-4"
        />
      </button>
    </div>

    <!-- Navigation List -->
    <div class="flex-1 overflow-y-auto px-3 py-4">
      <nav class="space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :title="isCollapsed ? item.label : undefined"
          :class="[
            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150',
            isActive(item.to)
              ? 'bg-primary-50 text-primary-700 shadow-xs dark:bg-primary-950/60 dark:text-primary-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white',
            isCollapsed ? 'justify-center px-0' : '',
          ]"
        >
          <UIcon
            :name="item.icon"
            :class="[
              'h-5 w-5 shrink-0 transition-colors',
              isActive(item.to)
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
            ]"
          />
          <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
          <span
            v-if="!isCollapsed && item.badge"
            class="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          >
            {{ item.badge }}
          </span>
        </NuxtLink>
      </nav>
    </div>

    <!-- Bottom Seller Switcher -->
    <div
      v-if="!isCollapsed"
      class="border-t border-slate-200 p-3 dark:border-slate-800"
    >
      <SellerSwitcher />
    </div>
  </aside>
</template>
