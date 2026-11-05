import { defineStore } from "pinia";

export interface UIState {
  isSidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
  activeSearchQuery: string;
}

export const useUIStore = defineStore("ui", {
  state: (): UIState => ({
    isSidebarCollapsed: false,
    isMobileMenuOpen: false,
    activeSearchQuery: "",
  }),

  actions: {
    initFromStorage() {
      if (import.meta.client) {
        const collapsed = localStorage.getItem("larekmart_sidebar_collapsed");
        if (collapsed !== null) {
          this.isSidebarCollapsed = collapsed === "true";
        }
      }
    },

    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      if (import.meta.client) {
        localStorage.setItem("larekmart_sidebar_collapsed", String(this.isSidebarCollapsed));
      }
    },

    setSidebarCollapsed(collapsed: boolean) {
      this.isSidebarCollapsed = collapsed;
      if (import.meta.client) {
        localStorage.setItem("larekmart_sidebar_collapsed", String(collapsed));
      }
    },

    openMobileMenu() {
      this.isMobileMenuOpen = true;
    },

    closeMobileMenu() {
      this.isMobileMenuOpen = false;
    },

    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    },

    setSearchQuery(query: string) {
      this.activeSearchQuery = query;
    },
  },
});
