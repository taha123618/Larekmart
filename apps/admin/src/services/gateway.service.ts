/**
 * gateway.service.ts
 *
 * Admin client service for communicating with the centralized API Gateway (port 8080).
 */

import type { GatewayHealthResponse } from "@repo/types";

/**
 * Returns the API Gateway base URL.
 * - Browser: Defaults to relative root ("") so requests (/api/v1/...) route through
 *   the Traefik reverse-proxy dynamically. If NEXT_PUBLIC_API_GATEWAY_URL is provided,
 *   it is sanitized: if accessing from a remote domain but the URL contains localhost,
 *   the localhost override is safely discarded to prevent client build-lock breaks.
 * - Server (Node SSR): Uses INTERNAL_API_GATEWAY_URL or API_GATEWAY_URL, falling back
 *   to direct localhost:8080 (or NEXT_PUBLIC_API_GATEWAY_URL) for absolute URL fetches.
 */
export const getApiGatewayUrl = (): string => {
  if (typeof window !== "undefined") {
    const publicUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
    if (publicUrl && publicUrl.trim() !== "") {
      const isLocalhostHost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0";
      const isLocalhostUrl =
        publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1");

      // Discard localhost baked values if client is accessing from a remote domain
      if (!isLocalhostHost && isLocalhostUrl) {
        return "";
      }
      return publicUrl.replace(/\/+$/, "");
    }
    // Relative request prefix for same-origin proxying behind Traefik/edge
    return "";
  }

  // Server-side (Node SSR): requires an absolute URL for native fetch
  return (
    process.env.INTERNAL_API_GATEWAY_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8080"
  ).replace(/\/+$/, "");
};

/**
 * Resolves a microservice endpoint with optional environment override,
 * falling back to the centralized API Gateway URL if the override is omitted.
 */
export const getServiceUrl = (serviceEnvValue?: string): string => {
  if (serviceEnvValue && serviceEnvValue.trim() !== "") {
    if (typeof window !== "undefined") {
      const isLocalhostHost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0";
      const isLocalhostUrl =
        serviceEnvValue.includes("localhost") ||
        serviceEnvValue.includes("127.0.0.1");

      if (!isLocalhostHost && isLocalhostUrl) {
        return getApiGatewayUrl();
      }
    }
    return serviceEnvValue.replace(/\/+$/, "");
  }
  return getApiGatewayUrl();
};

/**
 * Resolves the WebSocket URL for notification feeds.
 * Dynamically infers ws:// or wss:// from the current window location in browser,
 * avoiding hardcoded localhost overrides on staging/production environments.
 */
export const getNotificationWsUrl = (): string => {
  const wsEnv = process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL;
  if (typeof window !== "undefined") {
    const isLocalhostHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0";
    const isLocalhostUrl = wsEnv
      ? wsEnv.includes("localhost") || wsEnv.includes("127.0.0.1")
      : false;

    if (wsEnv && wsEnv.trim() !== "" && (isLocalhostHost || !isLocalhostUrl)) {
      return wsEnv;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }
  return (
    process.env.INTERNAL_WS_URL ||
    process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL ||
    "ws://localhost:8080/ws"
  );
};

/**
 * Safely constructs a URL instance supporting relative path strings in both browser
 * and SSR environments without throwing "Invalid URL".
 */
export const buildSafeUrl = (endpoint: string, baseOverride?: string): URL => {
  if (baseOverride) {
    return new URL(endpoint, baseOverride);
  }
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (
          process.env.INTERNAL_API_GATEWAY_URL ||
          process.env.API_GATEWAY_URL ||
          "http://localhost:8080"
        ).replace(/\/+$/, "");
  return new URL(endpoint, base);
};

/**
 * Checks API Gateway health status from admin app.
 */
export async function checkGatewayHealth(): Promise<GatewayHealthResponse | null> {
  try {
    const gatewayUrl = getApiGatewayUrl();
    const endpoint = "/health";
    const fullUrl = gatewayUrl ? `${gatewayUrl}${endpoint}` : endpoint;
    const res = await fetch(fullUrl, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as GatewayHealthResponse;
  } catch {
    return null;
  }
}

/**
 * Generic typed fetcher through the API Gateway for admin routes.
 */
export async function fetchViaGateway<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const gatewayUrl = getApiGatewayUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = gatewayUrl ? `${gatewayUrl}${cleanEndpoint}` : cleanEndpoint;

  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `admin_${Date.now()}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", requestId);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorPayload: { message?: string; statusCode?: number } = {};
    try {
      errorPayload = (await res.json()) as {
        message?: string;
        statusCode?: number;
      };
    } catch {
      errorPayload = { message: res.statusText, statusCode: res.status };
    }
    throw new Error(
      errorPayload.message ||
        `Gateway request failed with status ${res.status}`,
    );
  }

  return (await res.json()) as T;
}
