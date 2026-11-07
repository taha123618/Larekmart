import { useAuthStore } from "~/stores/auth.store";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const tokenCookie = useCookie("seller_session_token");

  // If already authenticated in Pinia store
  if (authStore.isAuthenticated) {
    return;
  }

  // If we have a cookie token, verify it via our session API
  const token = tokenCookie.value || authStore.sessionToken;

  if (token) {
    try {
      const session = await $fetch<{ authenticated: boolean; userId?: string }>(
        "/api/auth/session",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (session?.authenticated && session.userId) {
        authStore.setAuth({
          userId: session.userId,
          token,
        });
        return;
      }
    } catch {
      // Verification error, proceed to login redirect
    }
  }

  // Clear stale state and redirect to login
  authStore.clearAuth();
  return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
});
