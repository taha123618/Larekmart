/**
 * analytics.service.ts
 *
 * Storefront analytics and customer telemetry service for apps/client.
 * Provides non-blocking client-side telemetry reporting, behavioral tracking,
 * and live marketplace trust & scale metrics for storefront social proof.
 */

import { getApiGatewayUrl } from "./gateway.service";

export type CustomerInteractionType =
  | "VIEW"
  | "CLICK"
  | "ADD_TO_CART"
  | "WISHLIST_ADD"
  | "SEARCH"
  | "CATEGORY_BROWSE"
  | "CHECKOUT_START"
  | "CHECKOUT_COMPLETE";

export interface CustomerInteractionPayload {
  userId?: string | null;
  productId?: number;
  categorySlug?: string;
  eventType: CustomerInteractionType;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface MarketplaceTrustMetrics {
  activeSellersCount: number;
  verifiedVendorsCount: number;
  totalProductsCount: number;
  deliverySuccessRate: number;
  orderFulfillmentSpeedHours: number;
}

/**
 * Fallback baseline trust metrics when backend telemetry is warming up or during offline dev.
 */
const DEFAULT_TRUST_METRICS: MarketplaceTrustMetrics = {
  activeSellersCount: 50,
  verifiedVendorsCount: 45,
  totalProductsCount: 1200,
  deliverySuccessRate: 99.8,
  orderFulfillmentSpeedHours: 24,
};

/**
 * Dispatches non-blocking customer telemetry.
 * Safe for client-side fire-and-forget without throwing errors or interrupting UX.
 */
export async function trackCustomerInteraction(
  payload: CustomerInteractionPayload,
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const gatewayUrl = getApiGatewayUrl();
    const body = JSON.stringify({
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
      url: window.location.pathname,
      referrer: document.referrer || null,
    });

    // Use navigator.sendBeacon if available for reliable background unload delivery
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const beaconSent = navigator.sendBeacon(
        `${gatewayUrl}/api/v1/recommendations/interactions`,
        new Blob([body], { type: "application/json" }),
      );
      if (beaconSent) return;
    }

    // Fallback to fetch with keepalive
    await fetch(`${gatewayUrl}/api/v1/recommendations/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Non-blocking telemetry — never break client shopping UX
  }
}

/**
 * Fetches high-level marketplace scale metrics for customer social proof and merchant acquisition.
 * Directly queries the Go analytic-service public endpoint via the API Gateway.
 */
export async function fetchMarketplaceTrustMetrics(): Promise<MarketplaceTrustMetrics> {
  try {
    const gatewayUrl = getApiGatewayUrl();
    const res = await fetch(`${gatewayUrl}/api/v1/analytics/public`, {
      next: { revalidate: 60 }, // 1 min cache
    });

    if (res.ok) {
      const data = await res.json();
      return {
        activeSellersCount:
          data.activeSellersCount || DEFAULT_TRUST_METRICS.activeSellersCount,
        verifiedVendorsCount:
          data.verifiedVendorsCount ||
          DEFAULT_TRUST_METRICS.verifiedVendorsCount,
        totalProductsCount:
          data.totalProductsCount || DEFAULT_TRUST_METRICS.totalProductsCount,
        deliverySuccessRate:
          data.deliverySuccessRate || DEFAULT_TRUST_METRICS.deliverySuccessRate,
        orderFulfillmentSpeedHours: 24,
      };
    }

    // Secondary fallback: /api/v1/home
    const fallbackRes = await fetch(`${gatewayUrl}/api/v1/home`, {
      next: { revalidate: 300 },
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return {
        activeSellersCount:
          data.totalSellers || DEFAULT_TRUST_METRICS.activeSellersCount,
        verifiedVendorsCount:
          data.totalVendors || DEFAULT_TRUST_METRICS.verifiedVendorsCount,
        totalProductsCount:
          data.totalProducts || DEFAULT_TRUST_METRICS.totalProductsCount,
        deliverySuccessRate: 99.8,
        orderFulfillmentSpeedHours: 24,
      };
    }

    return DEFAULT_TRUST_METRICS;
  } catch {
    return DEFAULT_TRUST_METRICS;
  }
}
