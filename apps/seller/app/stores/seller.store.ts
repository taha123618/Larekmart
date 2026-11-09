import { defineStore } from "pinia";
import type { Seller } from "~/types";

export interface SellerState {
  sellers: Seller[];
  activeSellerId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useSellerStore = defineStore("seller", {
  state: (): SellerState => ({
    sellers: [],
    activeSellerId: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    activeSeller: (state): Seller | null => {
      if (!state.activeSellerId || state.sellers.length === 0) {
        return state.sellers[0] ?? null;
      }
      return state.sellers.find((s) => s.id === state.activeSellerId) ?? state.sellers[0] ?? null;
    },
    hasSellers: (state): boolean => state.sellers.length > 0,
    activeStoreName(): string {
      return (
        this.activeSeller?.store?.name ??
        this.activeSeller?.storeName ??
        "My Seller Store"
      );
    },
  },

  actions: {
    initFromStorage() {
      // 1. Check cookie first (available in both SSR and Client)
      try {
        if (typeof useCookie === "function") {
          const activeCookie = useCookie<string | null>("seller_active_id");
          if (activeCookie.value) {
            this.activeSellerId = activeCookie.value;
            return;
          }
        }
      } catch {
        // Safe fallback in test environments
      }

      // 2. Client-side localStorage fallback
      if (typeof window !== "undefined" && window.localStorage) {
        const storedId = localStorage.getItem("larekmart_active_seller_id");
        if (storedId) {
          this.activeSellerId = storedId;
        }
      }
    },

    setActiveSeller(sellerId: string) {
      this.activeSellerId = sellerId;
      try {
        if (typeof useCookie === "function") {
          const activeCookie = useCookie<string | null>("seller_active_id", {
            maxAge: 60 * 60 * 24 * 7,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
          activeCookie.value = sellerId;
        }
      } catch {
        // Safe fallback in test environments
      }

      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("larekmart_active_seller_id", sellerId);
      }
    },

    setSellers(sellers: Seller[]) {
      this.sellers = sellers;
      if (sellers.length > 0) {
        if (!this.activeSellerId || !sellers.some((s) => s.id === this.activeSellerId)) {
          const firstSeller = sellers[0];
          if (firstSeller) {
            this.setActiveSeller(firstSeller.id);
          }
        }
      } else {
        this.activeSellerId = null;
      }
    },

    clearSellers() {
      this.sellers = [];
      this.activeSellerId = null;
    },

    async fetchSellers() {
      this.isLoading = true;
      this.error = null;
      try {
        const api = useApi();
        const data = await api.get<Seller[]>("/api/v1/sellers/me");
        this.setSellers(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load seller profiles";
        this.error = message;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
