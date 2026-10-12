import {
  CartItemType,
  CartItemsType,
  CartResponseType,
  CartStoreActionsType,
  CartStoreStateType,
} from "@repo/types";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  cartClient,
  getOrCreateGuestToken,
  clearGuestToken,
} from "../services/cart.service";

export interface ExtendedCartState extends CartStoreStateType {
  serverCart: CartResponseType | null;
  isSyncing: boolean;
  error: string | null;
}

export interface ExtendedCartActions extends CartStoreActionsType {
  fetchServerCart: (authToken?: string) => Promise<void>;
  updateQuantity: (
    item: CartItemType,
    quantity: number,
    authToken?: string,
  ) => Promise<void>;
  applyCoupon: (
    code: string,
    authToken?: string,
  ) => Promise<{ success: boolean; message?: string }>;
  removeCoupon: (
    code: string,
    authToken?: string,
  ) => Promise<{ success: boolean; message?: string }>;
  mergeGuestCart: (authToken: string) => Promise<void>;
}

const mapServerItemsToCart = (
  serverItems: CartResponseType["items"],
): CartItemsType => {
  const consolidated = new Map<string, CartItemType>();

  for (const i of serverItems) {
    const key = `${i.productId}:${i.size || ""}:${i.color || ""}`;
    const existing = consolidated.get(key);

    if (existing) {
      existing.quantity = Math.min(existing.quantity + i.quantity, 10);
    } else {
      consolidated.set(key, {
        id: isNaN(Number(i.productId))
          ? (i.productId as unknown as number)
          : Number(i.productId),
        name: i.name,
        price: i.unitPrice,
        quantity: i.quantity,
        selectedSize: i.size || "",
        selectedColor: i.color || "",
        shortDescription: "",
        description: "",
        categorySlug: "general",
        sizes: [i.size || ""],
        colors: [i.color || ""],
        images: i.image ? { [i.color || "default"]: i.image } : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CartItemType);
    }
  }

  return Array.from(consolidated.values());
};

const useCartStore = create<ExtendedCartState & ExtendedCartActions>()(
  persist(
    (set, get) => ({
      cart: [],
      hasHydrated: false,
      serverCart: null,
      isSyncing: false,
      error: null,

      addToCart: (product, authToken) => {
        // 1. Optimistic local state update
        set((state) => {
          const existingIndex = state.cart.findIndex(
            (p) =>
              p.id === product.id &&
              p.selectedSize === product.selectedSize &&
              p.selectedColor === product.selectedColor,
          );

          if (existingIndex !== -1) {
            const updatedCart = [...state.cart];
            updatedCart[existingIndex]!.quantity += product.quantity || 1;
            return { cart: updatedCart };
          }

          return {
            cart: [
              ...state.cart,
              {
                ...product,
                quantity: product.quantity || 1,
                selectedSize: product.selectedSize,
                selectedColor: product.selectedColor,
              },
            ],
          };
        });

        // 2. Asynchronously sync with cart-service via Axios
        const variantId = `${product.selectedSize || "default"}-${product.selectedColor || "default"}`;
        const imageUrl =
          typeof product.images === "object" && product.images !== null
            ? (product.images as Record<string, string>)[
                product.selectedColor || ""
              ] ||
              Object.values(product.images as Record<string, string>)[0] ||
              ""
            : "";

        cartClient
          .addItem(
            {
              productId: String(product.id),
              variantId,
              name: product.name,
              image: imageUrl,
              size: product.selectedSize,
              color: product.selectedColor,
              quantity: product.quantity || 1,
              unitPrice: product.price,
            },
            authToken,
          )
          .then((updatedServerCart) => {
            if (
              updatedServerCart &&
              updatedServerCart.items &&
              updatedServerCart.items.length > 0
            ) {
              set({
                serverCart: updatedServerCart,
                cart: mapServerItemsToCart(updatedServerCart.items),
              });
            } else if (updatedServerCart) {
              set({ serverCart: updatedServerCart });
            }
          })
          .catch((err) => {
            console.warn("Failed to sync cart item to cart-service:", err);
          });
      },

      removeFromCart: (product, authToken) => {
        // 1. Optimistic removal
        set((state) => ({
          cart: state.cart.filter(
            (p) =>
              !(
                p.id === product.id &&
                p.selectedSize === product.selectedSize &&
                p.selectedColor === product.selectedColor
              ),
          ),
        }));

        // 2. Sync removal with cart-service if we have server cart item id
        const currentServerCart = get().serverCart;
        const matchingItem = currentServerCart?.items.find(
          (i) =>
            i.productId === String(product.id) &&
            i.size === product.selectedSize &&
            i.color === product.selectedColor,
        );

        if (matchingItem?.id) {
          cartClient
            .removeItem(matchingItem.id, authToken)
            .then((updated) => {
              if (updated && updated.items) {
                set({
                  serverCart: updated,
                  cart: mapServerItemsToCart(updated.items),
                });
              } else if (updated) {
                set({ serverCart: updated });
              }
            })
            .catch((err) => {
              console.warn("Failed to remove item on server:", err);
            });
        }
      },

      updateQuantity: async (item, quantity, authToken) => {
        if (quantity <= 0) {
          get().removeFromCart(item, authToken);
          return;
        }

        // Optimistic update
        set((state) => ({
          cart: state.cart.map((p) =>
            p.id === item.id &&
            p.selectedSize === item.selectedSize &&
            p.selectedColor === item.selectedColor
              ? { ...p, quantity }
              : p,
          ),
        }));

        const currentServerCart = get().serverCart;
        const matchingItem = currentServerCart?.items.find(
          (i) =>
            i.productId === String(item.id) &&
            i.size === item.selectedSize &&
            i.color === item.selectedColor,
        );

        if (matchingItem?.id) {
          try {
            const updated = await cartClient.updateItem(
              matchingItem.id,
              quantity,
              authToken,
            );
            if (updated && updated.items) {
              set({
                serverCart: updated,
                cart: mapServerItemsToCart(updated.items),
              });
            } else if (updated) {
              set({ serverCart: updated });
            }
          } catch (err) {
            console.warn("Error updating quantity on cart-service:", err);
          }
        }
      },

      clearCart: (authToken) => {
        set({ cart: [], serverCart: null });
        cartClient.clearCart(authToken).catch(() => {});
      },

      fetchServerCart: async (authToken) => {
        set({ isSyncing: true, error: null });
        try {
          const serverCart = await cartClient.getCart(authToken);
          if (serverCart && serverCart.items && serverCart.items.length > 0) {
            set({
              cart: mapServerItemsToCart(serverCart.items),
              serverCart,
              isSyncing: false,
            });
          } else if (serverCart) {
            set({ serverCart, isSyncing: false });
          } else {
            set({ isSyncing: false });
          }
        } catch (err) {
          set({
            isSyncing: false,
            error: err instanceof Error ? err.message : "Failed to load cart",
          });
        }
      },

      applyCoupon: async (code, authToken) => {
        try {
          const updated = await cartClient.applyCoupon(code, authToken);
          set({ serverCart: updated });
          return { success: true };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to apply coupon";
          return { success: false, message };
        }
      },

      removeCoupon: async (code, authToken) => {
        try {
          const updated = await cartClient.removeCoupon(code, authToken);
          set({ serverCart: updated });
          return { success: true };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to remove coupon";
          return { success: false, message };
        }
      },

      mergeGuestCart: async (authToken) => {
        const guestToken = getOrCreateGuestToken();
        if (!guestToken || !authToken) return;

        try {
          const merged = await cartClient.mergeCart(guestToken, authToken);
          if (merged) {
            clearGuestToken();
            set({
              serverCart: merged,
              cart: mapServerItemsToCart(merged.items),
            });
          }
        } catch (err) {
          console.warn("Failed to merge guest cart upon sign-in:", err);
        }
      },
    }),
    {
      name: "cart",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      // `localStorage` is synchronous, so without this zustand rehydrates during module
      // evaluation - before React's first render. The server has no `localStorage` and
      // renders the initial empty cart, so the client would render the persisted one and
      // React would report a hydration mismatch. `CartStoreHydration` calls
      // `.persist.rehydrate()` once after mount instead, so the first client render
      // matches the server and the persisted cart is applied immediately afterwards.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
          // Hydrate server cart in background
          if (typeof window !== "undefined") {
            state.fetchServerCart().catch(() => {});
          }
        }
      },
    },
  ),
);

export default useCartStore;
