import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { cartClient, getOrCreateGuestToken } from "../services/cart.service";
import type {
  AddToCartInputType,
  CartResponseType,
  CartSummaryType,
} from "@repo/types";

export const CART_QUERY_KEY = ["cart"] as const;
export const CART_SUMMARY_KEY = ["cart", "summary"] as const;

/**
 * Hook to query active cart with TanStack React Query + Axios
 */
export const useCartQuery = () => {
  const { getToken, userId } = useAuth();
  const guestToken =
    typeof window !== "undefined" ? getOrCreateGuestToken() : "";

  return useQuery<CartResponseType | null>({
    queryKey: [...CART_QUERY_KEY, userId || "anonymous", guestToken],
    queryFn: async () => {
      const token = await getToken();
      return cartClient.getCart(token || undefined);
    },
    staleTime: 1000 * 10, // 10 seconds stale time
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to query cart summary for badges
 */
export const useCartSummaryQuery = () => {
  const { getToken, userId } = useAuth();
  const guestToken =
    typeof window !== "undefined" ? getOrCreateGuestToken() : "";

  return useQuery<CartSummaryType | null>({
    queryKey: [...CART_SUMMARY_KEY, userId || "anonymous", guestToken],
    queryFn: async () => {
      const token = await getToken();
      return cartClient.getSummary(token || undefined);
    },
    staleTime: 1000 * 15,
  });
};

/**
 * Hook to mutate cart: add item
 */
export const useAddToCartMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (input: AddToCartInputType) => {
      const token = await getToken();
      return cartClient.addItem(input, token || undefined);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, updatedCart);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CART_SUMMARY_KEY });
    },
  });
};

/**
 * Hook to mutate cart: update item quantity
 */
export const useUpdateCartItemMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      const token = await getToken();
      return cartClient.updateItem(itemId, quantity, token || undefined);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, updatedCart);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
};

/**
 * Hook to mutate cart: remove item
 */
export const useRemoveCartItemMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getToken();
      return cartClient.removeItem(itemId, token || undefined);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, updatedCart);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
};

/**
 * Hook to mutate cart: apply coupon code
 */
export const useApplyCouponMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (code: string) => {
      const token = await getToken();
      return cartClient.applyCoupon(code, token || undefined);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, updatedCart);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
};

/**
 * Hook to mutate cart: remove coupon code
 */
export const useRemoveCouponMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (code: string) => {
      const token = await getToken();
      return cartClient.removeCoupon(code, token || undefined);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, updatedCart);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
};

/**
 * Hook to mutate cart: clear all items
 */
export const useClearCartMutation = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return cartClient.clearCart(token || undefined);
    },
    onSuccess: () => {
      queryClient.setQueriesData({ queryKey: CART_QUERY_KEY }, null);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CART_SUMMARY_KEY });
    },
  });
};
