import { useAuthStore } from "~/stores/auth.store";
import { useSellerStore } from "~/stores/seller.store";
import { useApi } from "~/composables/useApi";
import type { Seller } from "~/types";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    if (typeof Buffer !== "undefined") {
      return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as Record<string, unknown>;
    }
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const sellerStore = useSellerStore();
  const tokenCookie = useCookie("seller_session_token");

  // 1. Verify Authentication
  const token = tokenCookie.value || authStore.sessionToken;
  if (!token) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }

  // Hydrate active store from cookie / storage immediately
  sellerStore.initFromStorage();

  // If token has sellerId embedded, extract it dynamically if activeSellerId not yet known
  if (!sellerStore.activeSellerId && token) {
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.sellerId === "string") {
      sellerStore.setActiveSeller(payload.sellerId);
    }
  }

  const api = useApi();

  // 2. Check Platform System Settings (isSeller flag)
  try {
    const settings = await api
      .get<{ isSellerEnabled?: boolean }>("/api/v1/system-settings")
      .catch(() => ({ isSellerEnabled: true }));

    if (settings && settings.isSellerEnabled === false) {
      return navigateTo("/seller-disabled");
    }
  } catch {
    // Defaults to true if route not yet mounted on gateway
  }

  // 3. Check Seller Profiles if not already populated in Pinia
  if (sellerStore.sellers.length === 0) {
    try {
      const sellers = await api.get<Seller[]>("/api/v1/sellers/me");
      if (Array.isArray(sellers) && sellers.length > 0) {
        sellerStore.setSellers(sellers);
      }
    } catch {
      // Ignore network error; fallback to empty list
    }
  }

  // If user still has no seller profile and no active seller, route to onboarding flow
  if (sellerStore.sellers.length === 0 && !sellerStore.activeSellerId) {
    if (to.path !== "/onboarding" && !to.path.startsWith("/onboarding/")) {
      return navigateTo("/onboarding");
    }
  }
});
