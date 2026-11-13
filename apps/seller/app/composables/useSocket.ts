import type { Socket } from "socket.io-client";

/**
 * Composable to access the shared Socket.io client instance.
 * Returns null during Server-Side Rendering (SSR).
 */
export function useSocket(): Socket | null {
  if (import.meta.server) {
    return null;
  }
  const nuxtApp = useNuxtApp();
  return nuxtApp.$socket ?? null;
}
