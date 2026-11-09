import { defineStore } from "pinia";
import type { AuthUser } from "~/types";

export interface AuthState {
  clerkUserId: string | null;
  sessionToken: string | null;
  user: AuthUser | null;
  isInitialized: boolean;
  isLoading: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    clerkUserId: null,
    sessionToken: null,
    user: null,
    isInitialized: false,
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => Boolean(state.sessionToken && state.clerkUserId),
    currentUser: (state): AuthUser | null => state.user,
  },

  actions: {
    setAuth(params: { userId: string; token: string; user?: AuthUser | null }) {
      this.clerkUserId = params.userId;
      this.sessionToken = params.token;
      if (params.user) {
        this.user = params.user;
      }
      this.isInitialized = true;

      // Keep token in cookie for SSR hydration
      if (typeof useCookie === "function") {
        try {
          const tokenCookie = useCookie("seller_session_token", {
            maxAge: 60 * 60 * 24 * 7, // 7 days
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
          tokenCookie.value = params.token;
        } catch {
          // Ignore in non-Nuxt runtime
        }
      }
    },

    clearAuth() {
      this.clerkUserId = null;
      this.sessionToken = null;
      this.user = null;
      this.isInitialized = true;

      if (typeof useCookie === "function") {
        try {
          const tokenCookie = useCookie("seller_session_token");
          tokenCookie.value = null;
        } catch {
          // Ignore in non-Nuxt runtime
        }
      }
    },

    async signOut() {
      this.clearAuth();
      try {
        if (typeof useRouter === "function") {
          const router = useRouter();
          await router.push("/login");
        } else if (typeof navigateTo === "function") {
          await navigateTo("/login");
        }
      } catch {
        // Ignore navigation failure during teardown
      }
    },
  },
});
