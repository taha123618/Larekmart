/**
 * analytics.service.ts
 *
 * Dedicated admin service for querying the high-throughput Go analytic-service (:8004)
 * through the API Gateway reverse-proxy (/api/v1/analytics or /analytics).
 */

import { getApiGatewayUrl } from "./gateway.service";
import type {
  AnalyticsDailyChartType,
  AnalyticsEventType,
  AnalyticsSummaryType,
  MerchantAnalyticsMetricsType,
  OperationsAnalyticsMetricsType,
  CommerceAnalyticsMetricsType,
} from "@repo/types";

const getBaseUrl = (): string => {
  const gatewayUrl = getApiGatewayUrl();
  return `${gatewayUrl}/analytics`;
};

/**
 * Fetches the real-time KPI summary (revenue, orders, signups, products, seller counts).
 * Backed by lock-free in-memory atomic counters in analytic-service for <1ms latency.
 */
export async function fetchAnalyticsSummary(
  token?: string | null,
): Promise<AnalyticsSummaryType | null> {
  try {
    const url = `${getBaseUrl()}/summary`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as AnalyticsSummaryType;
  } catch {
    return null;
  }
}

/**
 * Fetches operational telemetry (fulfillment, shipping, inventory, returns, disputes).
 */
export async function fetchOperationsAnalytics(
  token?: string | null,
): Promise<OperationsAnalyticsMetricsType | null> {
  try {
    const url = `${getBaseUrl()}/operations`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as OperationsAnalyticsMetricsType;
  } catch {
    return null;
  }
}

/**
 * Fetches commercial telemetry (revenue, tax calculations, discounts applied, cart volume).
 */
export async function fetchCommerceAnalytics(
  token?: string | null,
): Promise<CommerceAnalyticsMetricsType | null> {
  try {
    const url = `${getBaseUrl()}/commerce`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as CommerceAnalyticsMetricsType;
  } catch {
    return null;
  }
}

/**
 * Fetches multi-vendor merchant statistics (registered vendors, verified KYBs, active sellers).
 */
export async function fetchMerchantAnalytics(
  token?: string | null,
): Promise<MerchantAnalyticsMetricsType | null> {
  try {
    const url = `${getBaseUrl()}/merchants`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as MerchantAnalyticsMetricsType;
  } catch {
    return null;
  }
}

/**
 * Fetches daily time-series chart points for revenue, orders, signups, and catalog growth.
 * Served from Redis read-through cache (60s TTL) with PostgreSQL partition fallback.
 */
export async function fetchDailyAnalyticsChart(
  days: number = 30,
  token?: string | null,
): Promise<AnalyticsDailyChartType[]> {
  try {
    const safeDays = Math.max(1, Math.min(365, days));
    const url = `${getBaseUrl()}/daily-chart?days=${safeDays}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return [];
    }

    return (await res.json()) as AnalyticsDailyChartType[];
  } catch {
    return [];
  }
}

/**
 * Fetches the most recent platform audit events (payments, registrations, promotions, moderation).
 * Served from Redis read-through cache (15s TTL) or in-memory circular buffer fallback.
 */
export async function fetchAnalyticsEvents(
  limit: number = 20,
  token?: string | null,
): Promise<AnalyticsEventType[]> {
  try {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const url = `${getBaseUrl()}/events?limit=${safeLimit}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return [];
    }

    return (await res.json()) as AnalyticsEventType[];
  } catch {
    return [];
  }
}
