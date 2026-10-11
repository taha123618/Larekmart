"use client";

import { create } from "zustand";
import { ProductType } from "@repo/types";

interface UIState {
  isCartDrawerOpen: boolean;
  isWishlistDrawerOpen: boolean;
  quickViewProduct: ProductType | null;
  activeMegaMenu: string | null;
  searchOverlayOpen: boolean;

  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;

  openWishlistDrawer: () => void;
  closeWishlistDrawer: () => void;
  toggleWishlistDrawer: () => void;

  openQuickView: (product: ProductType) => void;
  closeQuickView: () => void;

  setActiveMegaMenu: (category: string | null) => void;
  setSearchOverlayOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCartDrawerOpen: false,
  isWishlistDrawerOpen: false,
  quickViewProduct: null,
  activeMegaMenu: null,
  searchOverlayOpen: false,

  openCartDrawer: () => set({ isCartDrawerOpen: true }),
  closeCartDrawer: () => set({ isCartDrawerOpen: false }),
  toggleCartDrawer: () =>
    set((state) => ({ isCartDrawerOpen: !state.isCartDrawerOpen })),

  openWishlistDrawer: () => set({ isWishlistDrawerOpen: true }),
  closeWishlistDrawer: () => set({ isWishlistDrawerOpen: false }),
  toggleWishlistDrawer: () =>
    set((state) => ({ isWishlistDrawerOpen: !state.isWishlistDrawerOpen })),

  openQuickView: (product: ProductType) => set({ quickViewProduct: product }),
  closeQuickView: () => set({ quickViewProduct: null }),

  setActiveMegaMenu: (category: string | null) => set({ activeMegaMenu: category }),
  setSearchOverlayOpen: (isOpen: boolean) => set({ searchOverlayOpen: isOpen }),
}));
