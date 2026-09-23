"use client";

import { useEffect } from "react";
import useCartStore from "@/stores/cartStore";

/**
 * Rehydrates the persisted cart store once, after hydration.
 *
 * `cartStore` sets `skipHydration: true` because `localStorage` is synchronous: zustand
 * would otherwise rehydrate while the module is still being evaluated, i.e. before
 * React's first render. The server has no `localStorage` and renders the initial empty
 * cart, so the client rendering the persisted one is a hydration mismatch.
 *
 * Deferring to an effect keeps the first client render identical to the server's. The
 * persisted cart lands in the store immediately afterwards, which flips `hasHydrated` to
 * `true` and lets `ShoppingCartIcon` render its count.
 *
 * Render this once, from the root layout.
 */
const CartStoreHydration = () => {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
};

export default CartStoreHydration;
