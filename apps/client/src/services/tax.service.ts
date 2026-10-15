/**
 * tax.service.ts — Storefront client for tax-service (:8017) via API Gateway (:8090).
 */

import type {
  TaxQuoteRequest,
  TaxCalculationResponse,
  TaxCategory,
  TaxJurisdiction,
} from "@repo/types";
import { getOrCreateGuestToken } from "./cart.service";

const API_BASE =
  process.env.NEXT_PUBLIC_TAX_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${API_BASE}/api/v1/tax`;

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-guest-token": getOrCreateGuestToken(),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return headers;
}

/**
 * Calculate estimated tax quote for a customer destination address and cart lines.
 */
export async function getTaxQuote(
  input: TaxQuoteRequest,
  authToken?: string,
): Promise<TaxCalculationResponse> {
  const res = await fetch(`${BASE}/quote`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to calculate tax quote (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch available tax categories for product tax classifications.
 */
export async function fetchTaxCategories(): Promise<TaxCategory[]> {
  try {
    const res = await fetch(`${BASE}/categories`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch tax categories (HTTP ${res.status})`);
    }

    return res.json();
  } catch (err) {
    console.warn("fetchTaxCategories error:", err);
    return [];
  }
}

/**
 * Fetch active tax jurisdictions.
 */
export async function fetchTaxJurisdictions(): Promise<TaxJurisdiction[]> {
  try {
    const res = await fetch(`${BASE}/jurisdictions`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch tax jurisdictions (HTTP ${res.status})`);
    }

    return res.json();
  } catch (err) {
    console.warn("fetchTaxJurisdictions error:", err);
    return [];
  }
}
