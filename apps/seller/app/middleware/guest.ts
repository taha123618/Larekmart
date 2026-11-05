import { useAuthStore } from "~/stores/auth.store";

export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore();
  const tokenCookie = useCookie("seller_session_token");

  if (authStore.isAuthenticated || tokenCookie.value) {
    return navigateTo("/dashboard");
  }
});
