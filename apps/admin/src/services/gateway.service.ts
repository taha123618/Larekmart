/**
 * gateway.service.ts
 *
 * Admin client service for communicating with the centralized API Gateway (port 8080).
 */

import type { GatewayHealthResponse } from "@repo/types";

export const getApiGatewayUrl = (): string => {
  if (typeof window !== "undefined") {
    // In browser: allow relative requests (e.g. "" or specific URL) for same-origin proxying
    return process.env.NEXT_PUBLIC_API_GATEWAY_URL !== undefined
      ? process.env.NEXT_PUBLIC_API_GATEWAY_URL
      : "http://localhost:8090";
  }
  // Server-side (Node SSR): requires an absolute URL
  return (
    process.env.INTERNAL_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090"
  );
};

/**
 * Resolves a microservice endpoint with optional environment override,
 * falling back to the centralized API Gateway URL if the override is omitted.
 */
export const getServiceUrl = (serviceEnvValue?: string): string => {
  return serviceEnvValue || getApiGatewayUrl();
};

/**
 * Checks API Gateway health status from admin app.
 */
export async function checkGatewayHealth(): Promise<GatewayHealthResponse | null> {
  try {
    const gatewayUrl = getApiGatewayUrl();
    const res = await fetch(`${gatewayUrl}/health`, {
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
  const url = `${gatewayUrl}${cleanEndpoint}`;

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
