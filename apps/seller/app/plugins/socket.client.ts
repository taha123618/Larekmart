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
  const token =
    authStore.sessionToken || useCookie("seller_session_token").value;

  const socket: Socket = io(wsUrl, {
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: {
      token: token ? `Bearer ${token}` : "",
    },
  });

  if (token) {
    socket.connect();
  }

  // Auto connect when user becomes authenticated
  authStore.$subscribe((_mutation, state) => {
    if (state.sessionToken && !socket.connected) {
      socket.auth = { token: `Bearer ${state.sessionToken}` };
      socket.connect();
    } else if (!state.sessionToken && socket.connected) {
      socket.disconnect();
    }
  });

  return {
    provide: {
      socket,
    },
  };
});
