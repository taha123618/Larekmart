"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProductType } from "@repo/types";
import {
  fetchMyWishlists,
  fetchWishlistById,
  createWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  createWishlistShareToken,
  mergeGuestWishlist,
} from "@/services/wishlist.service";
import { getOrCreateGuestToken } from "@/services/cart.service";

export interface WishlistItem {
  id: number;
  name: string;
  price: number;
  image: string;
  categorySlug: string;
  addedAt: string;
  backendItemId?: string;
  inStock?: boolean;
  addedPriceInPaisa?: number;
  currentPriceInPaisa?: number;
}

export interface WishlistSummaryInfo {
  id: string;
  name: string;
  isDefault: boolean;
  visibility: string;
  itemCount?: number;
}

interface WishlistState {
  items: WishlistItem[];
  wishlists: WishlistSummaryInfo[];
  activeWishlistId: string | null;
  activeWishlistName: string;
  isLoading: boolean;
  isSyncing: boolean;

  // Local & Optimistic Actions (synchronous signatures for 100% backward compatibility)
  addToWishlist: (product: ProductType) => void;
  removeFromWishlist: (productId: number) => void;
  toggleWishlist: (product: ProductType) => boolean;
  isInWishlist: (productId: number) => boolean;
  clearWishlist: () => void;

  // Backend Sync & Multi-Wishlist
  syncWithBackend: (authToken?: string) => Promise<void>;
  selectWishlist: (wishlistId: string, authToken?: string) => Promise<void>;
  createNewWishlist: (
    name: string,
    authToken?: string,
  ) => Promise<string | null>;
  shareActiveWishlist: (authToken: string) => Promise<string | null>;
  mergeGuestWishlistOnLogin: (authToken: string) => Promise<number>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      wishlists: [],
      activeWishlistId: null,
      activeWishlistName: "My Wishlist",
      isLoading: false,
      isSyncing: false,

      addToWishlist: (product: ProductType) => {
        const { items, activeWishlistId } = get();
        if (items.some((i) => i.id === product.id)) return;

        const defaultImage =
          (product.images ? Object.values(product.images)[0] : "") || "";

        const newItem: WishlistItem = {
          id: product.id,
          name: product.name,
          price: product.price,
          image: defaultImage,
          categorySlug: product.categorySlug || "general",
          addedAt: new Date().toISOString(),
          inStock: true,
          addedPriceInPaisa: Math.round(product.price * 100),
          currentPriceInPaisa: Math.round(product.price * 100),
        };

        // 1. Optimistic local update
        set({ items: [...items, newItem] });

        // 2. Async backend sync if target wishlist is available
        if (activeWishlistId) {
          addItemToWishlist(activeWishlistId, {
            productId: String(product.id),
            addedPrice: product.price,
          })
            .then((added) => {
              set({
                items: get().items.map((i) =>
                  i.id === product.id ? { ...i, backendItemId: added.id } : i,
                ),
              });
            })
            .catch((err) => {
              console.warn(
                "[WishlistStore] Backend add failed, retained locally:",
                err,
              );
            });
        }
      },

      removeFromWishlist: (productId: number) => {
        const { items, activeWishlistId } = get();
        const itemToRemove = items.find((i) => i.id === productId);

        // 1. Optimistic removal
        set({ items: items.filter((i) => i.id !== productId) });

        // 2. Async backend removal
        if (activeWishlistId && itemToRemove?.backendItemId) {
          removeItemFromWishlist(
            activeWishlistId,
            itemToRemove.backendItemId,
          ).catch((err) => {
            console.warn("[WishlistStore] Backend remove failed:", err);
          });
        }
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

      clearWishlist: () => {
        const { items, activeWishlistId } = get();
        set({ items: [] });

        if (activeWishlistId && items.length > 0) {
          const itemIds = items
            .map((i) => i.backendItemId)
            .filter((id): id is string => Boolean(id));

          if (itemIds.length > 0) {
            import("@/services/wishlist.service")
              .then(({ bulkRemoveWishlistItems }) =>
                bulkRemoveWishlistItems(activeWishlistId, { itemIds }),
              )
              .catch((err) => {
                console.warn("[WishlistStore] Clear failed on backend:", err);
              });
          }
        }
      },

      syncWithBackend: async (authToken?: string) => {
        try {
          set({ isSyncing: true });

          // 1. Fetch user wishlists
          const { wishlists } = await fetchMyWishlists(authToken);
          const mappedLists: WishlistSummaryInfo[] = wishlists.map((w) => ({
            id: w.id,
            name: w.name,
            isDefault: w.isDefault,
            visibility: w.visibility,
          }));

          const defaultList =
            mappedLists.find((w) => w.isDefault) || mappedLists[0];

          if (!defaultList) {
            set({ isSyncing: false });
            return;
          }

          // 2. Fetch items for the default or active wishlist
          const targetId = get().activeWishlistId || defaultList.id;
          const details = await fetchWishlistById(targetId, authToken);

          const syncedItems: WishlistItem[] = details.items.map((item) => {
            const addedInPaisa = Number(item.addedPrice) * 100;
            const currentInPaisa = item.currentPrice
              ? Number(item.currentPrice) * 100
              : addedInPaisa;

            return {
              id: Number(item.productId) || Math.abs(hashCode(item.productId)),
              name: item.note || `Saved Product #${item.productId}`,
              price: item.currentPrice
                ? Number(item.currentPrice)
                : Number(item.addedPrice),
              image: "",
              categorySlug: "general",
              addedAt: new Date(item.createdAt).toISOString(),
              backendItemId: item.id,
              inStock: item.inStock,
              addedPriceInPaisa: addedInPaisa,
              currentPriceInPaisa: currentInPaisa,
            };
          });

          // Merge with any existing local-only metadata like image if present
          const existingMap = new Map(get().items.map((i) => [i.id, i]));
          const merged = syncedItems.map((item) => {
            const local = existingMap.get(item.id);
            return {
              ...item,
              name:
                local?.name && !local.name.startsWith("Saved Product #")
                  ? local.name
                  : item.name,
              image: local?.image || item.image,
              categorySlug: local?.categorySlug || item.categorySlug,
            };
          });

          set({
            wishlists: mappedLists,
            activeWishlistId: details.wishlist.id,
            activeWishlistName: details.wishlist.name,
            items: merged,
            isSyncing: false,
          });
        } catch (err) {
          console.warn("[WishlistStore] Sync error:", err);
          set({ isSyncing: false });
        }
      },

      selectWishlist: async (wishlistId: string, authToken?: string) => {
        try {
          set({ isLoading: true });
          const details = await fetchWishlistById(wishlistId, authToken);
          const mappedItems: WishlistItem[] = details.items.map((item) => ({
            id: Number(item.productId) || Math.abs(hashCode(item.productId)),
            name: item.note || `Saved Product #${item.productId}`,
            price: item.currentPrice
              ? Number(item.currentPrice)
              : Number(item.addedPrice),
            image: "",
            categorySlug: "general",
            addedAt: new Date(item.createdAt).toISOString(),
            backendItemId: item.id,
            inStock: item.inStock,
            addedPriceInPaisa: Number(item.addedPrice) * 100,
            currentPriceInPaisa: item.currentPrice
              ? Number(item.currentPrice) * 100
              : Number(item.addedPrice) * 100,
          }));

          set({
            activeWishlistId: details.wishlist.id,
            activeWishlistName: details.wishlist.name,
            items: mappedItems,
            isLoading: false,
          });
        } catch (err) {
          console.error("[WishlistStore] Failed to select wishlist:", err);
          set({ isLoading: false });
        }
      },

      createNewWishlist: async (name: string, authToken?: string) => {
        try {
          const created = await createWishlist(
            { name, visibility: "PRIVATE" },
            authToken,
          );
          const newSummary: WishlistSummaryInfo = {
            id: created.id,
            name: created.name,
            isDefault: created.isDefault,
            visibility: created.visibility,
          };

          set({
            wishlists: [...get().wishlists, newSummary],
            activeWishlistId: created.id,
            activeWishlistName: created.name,
            items: [],
          });

          return created.id;
        } catch (err) {
          console.error("[WishlistStore] Create wishlist failed:", err);
          return null;
        }
      },

      shareActiveWishlist: async (authToken: string) => {
        const { activeWishlistId } = get();
        if (!activeWishlistId) return null;

        try {
          const share = await createWishlistShareToken(
            activeWishlistId,
            { permission: "VIEW", expiresInDays: 30 },
            authToken,
          );

          if (typeof window !== "undefined") {
            return `${window.location.origin}/wishlist/${share.shareToken}`;
          }
          return `/wishlist/${share.shareToken}`;
        } catch (err) {
          console.error("[WishlistStore] Share wishlist failed:", err);
          return null;
        }
      },

      mergeGuestWishlistOnLogin: async (authToken: string) => {
        const guestId = getOrCreateGuestToken();
        try {
          const result = await mergeGuestWishlist({ guestId }, authToken);
          await get().syncWithBackend(authToken);
          return result.mergedCount;
        } catch (err) {
          console.warn("[WishlistStore] Merge on login failed:", err);
          return 0;
        }
      },
    }),
    {
      name: "larekmart_wishlist",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        items: state.items,
        wishlists: state.wishlists,
        activeWishlistId: state.activeWishlistId,
        activeWishlistName: state.activeWishlistName,
      }),
    },
  ),
);

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
