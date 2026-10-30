"use client";

import { useEffect } from "react";
import { fetchRuntimeConfig } from "@/services/gateway.service";

/**
 * RuntimeConfigProvider
 *
 * Fetches runtime configuration from /api/config on the client side and populates
 * window.__RUNTIME_CONFIG__ for dynamic API gateway URL resolution.
 * Must be rendered client-side (useEffect) to access window.
 */
export function RuntimeConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    void fetchRuntimeConfig();
  }, []);

  return <>{children}</>;
}
