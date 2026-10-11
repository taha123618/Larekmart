import axios, { AxiosError, type AxiosInstance } from "axios";
import type {
  AddToCartInputType,
  CartResponseType,
  CartSummaryType,
} from "@repo/types";

const GUEST_TOKEN_KEY = "larekmart_guest_token";

export const getCartServiceUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_CART_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090"
  );
};

export const getOrCreateGuestToken = (): string => {
  if (typeof window === "undefined") return "server-guest-token";

  try {
    let token = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!token) {
      token =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(GUEST_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return "ephemeral-guest-token";
  }
};

export const clearGuestToken = (): void => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(GUEST_TOKEN_KEY);
    } catch {
      // Ignore localStorage access failures in restricted environments
    }
  }
};

export const createCartApiClient = (authToken?: string): AxiosInstance => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-guest-token": getOrCreateGuestToken(),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return axios.create({
    baseURL: `${getCartServiceUrl()}/api/v1/cart`,
    headers,
    timeout: 12000,
  });
};

export const cartClient = {
  /**
   * Fetch active cart from cart-service via Axios
   */
  async getCart(authToken?: string): Promise<CartResponseType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.get<CartResponseType>("/");
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 404) {
          return null;
        }
        // Graceful fallback to client cart when service is offline or unreachable
        console.warn(
          `[CartService] Server cart unavailable (${err.response?.status || err.code || "offline"}). Using local cart fallback.`,
        );
        return null;
      }
      console.warn("Cart service error on getCart:", err);
      return null;
    }
  },

  /**
   * Fetch lightweight summary via Axios
   */
  async getSummary(authToken?: string): Promise<CartSummaryType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.get<CartSummaryType>("/summary");
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        return null;
      }
      console.warn("Cart service error on getSummary:", err);
      return null;
    }
  },

  /**
   * Add item to authoritative cart via Axios
   */
  async addItem(
    input: AddToCartInputType,
    authToken?: string,
  ): Promise<CartResponseType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.post<CartResponseType>("/items", input);
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      console.warn("Cart service Axios error on addItem:", err);
      throw err;
    }
  },

  /**
   * Update item quantity or variant via Axios
   */
  async updateItem(
    itemId: string,
    quantity: number,
    authToken?: string,
  ): Promise<CartResponseType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.patch<CartResponseType>(
        `/items/${itemId}`,
        { quantity },
      );
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      console.warn("Cart service Axios error on updateItem:", err);
      throw err;
    }
  },

  /**
   * Remove item from cart via Axios
   */
  async removeItem(
    itemId: string,
    authToken?: string,
  ): Promise<CartResponseType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.delete<CartResponseType>(
        `/items/${itemId}`,
      );
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      console.warn("Cart service Axios error on removeItem:", err);
      throw err;
    }
  },

  /**
   * Apply promotional coupon via Axios
   */
  async applyCoupon(
    code: string,
    authToken?: string,
  ): Promise<CartResponseType> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.post<CartResponseType>("/coupons", {
        code,
      });
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error("Invalid or ineligible coupon code");
    }
  },

  /**
   * Remove coupon via Axios
   */
  async removeCoupon(
    code: string,
    authToken?: string,
  ): Promise<CartResponseType> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.delete<CartResponseType>(
        `/coupons/${encodeURIComponent(code)}`,
      );
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error("Failed to remove coupon");
    }
  },

  /**
   * Clear all items in cart via Axios
   */
  async clearCart(authToken?: string): Promise<void> {
    try {
      const client = createCartApiClient(authToken);
      await client.delete("/");
    } catch (err) {
      console.warn("Cart service Axios error on clearCart:", err);
    }
  },

  /**
   * Merge anonymous guest cart into authenticated user cart via Axios
   */
  async mergeCart(
    guestToken: string,
    authToken: string,
  ): Promise<CartResponseType | null> {
    try {
      const client = createCartApiClient(authToken);
      const response = await client.post<CartResponseType>("/merge", {
        guestToken,
      });
      return response.data;
    } catch (err) {
      console.warn("Cart service Axios error on mergeCart:", err);
      return null;
    }
  },
};
