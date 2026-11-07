import { useAuthStore } from "~/stores/auth.store";
import { useSellerStore } from "~/stores/seller.store";
import { useApi } from "~/composables/useApi";
import type { Seller } from "~/types";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const sellerStore = useSellerStore();
  const tokenCookie = useCookie("seller_session_token");

  // 1. Verify Authentication
  const token = tokenCookie.value || authStore.sessionToken;
  if (!token) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
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

  // 3. Check Seller Profiles
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

  // If user still has no seller profile, route to onboarding flow
  if (sellerStore.sellers.length === 0) {
    if (to.path !== "/onboarding" && !to.path.startsWith("/onboarding/")) {
      return navigateTo("/onboarding");
    }
  } else {
    sellerStore.initFromStorage();
  }
});
