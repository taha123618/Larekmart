/**
 * commission.service.ts — Client service for order commission breakdowns, quotes, and rate transparencies.
 */

import type {
  CommissionQuoteRequest,
  CommissionQuoteResponse,
  CommissionCalculationType,
  CommissionLineItemInput,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Fetch authoritative commission quote for cart/checkout items
 */
export async function fetchCommissionQuote(
  items: CommissionLineItemInput[],
  currency: string = "PKR",
  orderId?: string,
  authToken?: string,
): Promise<CommissionQuoteResponse> {
  const payload: CommissionQuoteRequest = {
    orderId,
    currency,
    items,
  };

  const res = await fetch(`${API_BASE}/api/v1/internal/commissions/quote`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to calculate commission quote (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch detailed commission calculation breakdown for an order
 */
export async function fetchOrderCommission(
  orderId: string,
  authToken?: string,
): Promise<{ calculation: CommissionCalculationType | null }> {
  const res = await fetch(
    `${API_BASE}/api/v1/internal/commissions/orders/${orderId}`,
    {
      headers: getHeaders(authToken),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch order commission (HTTP ${res.status})`,
    );
  }

  return res.json();
}
