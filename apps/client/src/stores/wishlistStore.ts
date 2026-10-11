"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProductType } from "@repo/types";

export interface WishlistItem {
  id: number;
  name: string;
  price: number;
  image: string;
  categorySlug: string;
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  addToWishlist: (product: ProductType) => void;
  removeFromWishlist: (productId: number) => void;
  toggleWishlist: (product: ProductType) => boolean;
  isInWishlist: (productId: number) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addToWishlist: (product: ProductType) => {
        const { items } = get();
        if (items.some((i) => i.id === product.id)) return;

        const defaultImage =
          (product.images ? Object.values(product.images)[0] : "") || "";

        set({
          items: [
            ...items,
            {
              id: product.id,
              name: product.name,
              price: product.price,
              image: defaultImage,
              categorySlug: product.categorySlug || "general",
              addedAt: new Date().toISOString(),
            },
          ],
        });
      },

      removeFromWishlist: (productId: number) => {
        set({ items: get().items.filter((i) => i.id !== productId) });
      },

      toggleWishlist: (product: ProductType) => {
        const { items, addToWishlist, removeFromWishlist } = get();
        const exists = items.some((i) => i.id === product.id);
        if (exists) {
          removeFromWishlist(product.id);
          return false;
        } else {
          addToWishlist(product);
          return true;
        }
      },

      isInWishlist: (productId: number) => {
        return get().items.some((i) => i.id === productId);
      },

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: "larekmart_wishlist",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
