import { io, Socket } from "socket.io-client";
import { useAuthStore } from "~/stores/auth.store";

declare module "nuxt/app" {
  interface NuxtApp {
    $socket: Socket;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $socket: Socket;
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const wsUrl = config.public.wsUrl || "http://localhost:8090";
  const rawToken =
    authStore.sessionToken || useCookie("seller_session_token").value;
  const token = rawToken
    ? rawToken.startsWith("Bearer ")
      ? rawToken
      : `Bearer ${rawToken}`
    : "";

  const socket: Socket = io(wsUrl, {
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: {
      token,
      userId: authStore.clerkUserId || authStore.user?.id || "",
      role: "seller",
      isSeller: true,
    },
  });

  // Connection lifecycle hooks
  socket.on("connect", () => {
    if (import.meta.dev) {
      console.info(
        `[Socket.io] Connected to seller gateway at ${wsUrl} (id: ${socket.id})`,
      );
    }
  });

  socket.on("connect_error", (error) => {
    if (import.meta.dev) {
      console.warn(`[Socket.io] Connection error: ${error.message}`);
    }
  });

  socket.on("disconnect", (reason) => {
    if (import.meta.dev) {
      console.info(`[Socket.io] Disconnected: ${reason}`);
    }
  });

  if (token) {
    socket.connect();
  }

  // Reactive subscription: auto connect/disconnect when auth changes
  authStore.$subscribe((_mutation, state) => {
    const activeToken = state.sessionToken
      ? state.sessionToken.startsWith("Bearer ")
        ? state.sessionToken
        : `Bearer ${state.sessionToken}`
      : "";

    if (activeToken) {
      socket.auth = {
        token: activeToken,
        userId: state.clerkUserId || state.user?.id || "",
        role: "seller",
        isSeller: true,
      };
      if (!socket.connected) {
        socket.connect();
      }
    } else if (!activeToken && socket.connected) {
      socket.disconnect();
    }
  });

  return {
    provide: {
      socket,
    },
  };
});
