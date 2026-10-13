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

export const getApiGatewayUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090";
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
    const url = new URL(`${gatewayUrl}/api/v1/home`);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch(url.toString(), {
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
 * Generic typed fetcher through the API Gateway with correlation ID propagation.
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
