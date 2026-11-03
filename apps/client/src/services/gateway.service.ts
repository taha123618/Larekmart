/**
 * gateway.service.ts
 *
 * Storefront client service for communicating with the centralized API Gateway (port 8080).
 * Provides read aggregation (such as /api/v1/home), telemetry, and unified error handling.
 */

import type {
  GatewayHomeAggregationResponse,
  GatewayHealthResponse,
} from "@repo/types";

/**
 * Returns the API Gateway base URL.
 * - Browser: Defaults to relative root ("") so requests (/api/v1/...) route through
 *   the Traefik reverse-proxy dynamically. Prioritizes window.__RUNTIME_CONFIG__?.apiGatewayUrl
 *   if set at runtime. If NEXT_PUBLIC_API_GATEWAY_URL is provided, it is sanitized:
 *   any origin mismatch with the current browser location is discarded to eliminate
 *   hardcoded compile-time build lockouts on staging and Kubernetes environments.
 * - Server (Node SSR): Uses INTERNAL_API_GATEWAY_URL or API_GATEWAY_URL, falling back
 *   to direct localhost:8080 (or NEXT_PUBLIC_API_GATEWAY_URL) for absolute URL fetches.
 */
export const getApiGatewayUrl = (): string => {
  if (typeof window !== "undefined") {
    // 1. Runtime configuration provider wrapper (injected dynamically via SSR or /api/config)
    const runtimeUrl = window.__RUNTIME_CONFIG__?.apiGatewayUrl;
    if (runtimeUrl && runtimeUrl.trim() !== "") {
      return runtimeUrl.trim().replace(/\/+$/, "");
    }

    // 2. Validate compile-time NEXT_PUBLIC_API_GATEWAY_URL:
    // Only accept if it is an explicit relative path or matches the current browser origin.
    // Discard any hardcoded mismatch to prevent breaking deployments across Kubernetes/cloud environments.
    const publicUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
    if (publicUrl && publicUrl.trim() !== "") {
      const trimmed = publicUrl.trim();
      if (trimmed.startsWith("/")) {
        return trimmed.replace(/\/+$/, "");
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.origin === window.location.origin) {
          return trimmed.replace(/\/+$/, "");
        }
      } catch {
        // Discard malformed URL
      }
    }

    // 3. Dynamic relative location mapping path by default ("")
    // Browser routes all requests seamlessly to the current origin via Traefik edge reverse proxy
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
    const trimmed = serviceEnvValue.trim();
    if (typeof window !== "undefined") {
      if (trimmed.startsWith("/")) {
        return trimmed.replace(/\/+$/, "");
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.origin === window.location.origin) {
          return trimmed.replace(/\/+$/, "");
        }
      } catch {
        // Discard invalid URL
      }
      return getApiGatewayUrl();
    }
    return trimmed.replace(/\/+$/, "");
  }
  return getApiGatewayUrl();
};

/**
 * Resolves the WebSocket URL for notification feeds.
 * Dynamically infers ws:// or wss:// from the current window location in browser,
 * avoiding hardcoded localhost overrides on staging/production environments.
 */
export const getNotificationWsUrl = (): string => {
  if (typeof window !== "undefined") {
    const runtimeWs = window.__RUNTIME_CONFIG__?.wsUrl;
    if (runtimeWs && runtimeWs.trim() !== "") {
      return runtimeWs.trim().replace(/\/+$/, "");
    }

    const wsEnv = process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL;
    if (wsEnv && wsEnv.trim() !== "") {
      try {
        const parsed = new URL(wsEnv);
        if (parsed.host === window.location.host) {
          return wsEnv.trim().replace(/\/+$/, "");
        }
      } catch {
        // Discard invalid URL
      }
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

export interface RuntimeConfigData {
  apiGatewayUrl: string;
  wsUrl: string;
  environment: string;
}

/**
 * Fetches dynamic runtime configuration from the /api/config provider endpoint.
 * Sets window.__RUNTIME_CONFIG__ to update client-side routing dynamically without rebuilds.
 */
export async function fetchRuntimeConfig(): Promise<RuntimeConfigData | null> {
  if (typeof window === "undefined") {
    return {
      apiGatewayUrl:
        process.env.INTERNAL_API_GATEWAY_URL ||
        process.env.API_GATEWAY_URL ||
        "http://localhost:8080",
      wsUrl:
        process.env.INTERNAL_WS_URL ||
        process.env.NOTIFICATION_WS_URL ||
        "ws://localhost:8080/ws",
      environment: process.env.NODE_ENV || "development",
    };
  }

  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (!res.ok) return null;
    const config = (await res.json()) as RuntimeConfigData;
    window.__RUNTIME_CONFIG__ = config;
    return config;
  } catch {
    return null;
  }
}

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
 * Fetches aggregated homepage read model (featured products, categories, recommendations)
 * in a single network round-trip via the API Gateway.
 */
export async function getGatewayHomeAggregation(
  userId?: string,
): Promise<GatewayHomeAggregationResponse | null> {
  try {
    const gatewayUrl = getApiGatewayUrl();
    const endpoint = "/api/v1/home";
    const fullUrl = gatewayUrl ? `${gatewayUrl}${endpoint}` : endpoint;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch(fullUrl, {
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as GatewayHomeAggregationResponse;
  } catch (error) {
    console.warn("Failed to fetch home aggregation from API Gateway:", error);
    return null;
  }
}

/**
 * Checks API Gateway health status.
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
 * Generic typed fetcher through the API Gateway with correlation ID propagation.
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
      : `client_${Date.now()}`;

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
