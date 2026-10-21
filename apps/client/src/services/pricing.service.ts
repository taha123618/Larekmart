/**
 * pricing.service.ts — Storefront client for pricing-service (:8019) via API Gateway (:8090).
 */

import type {
  PriceRule,
  PriceQuote,
  PriceQuoteRequest,
  BulkPriceQuoteRequest,
  CurrencyRate,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_PRICING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${API_BASE}/api/v1/prices`;

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface ProductPricingDetails {
  productId: string;
  priceListId: string;
  priceListCode: string;
  basePrice: number;
  originalBasePrice: number;
  originalCurrency: string;
  currency: string;
  exchangeRate: number;
  compareAtPrice: number | null;
  variants: Array<{
    variantId: string;
    price: number;
    currency: string;
    compareAtPrice: number | null;
    sku?: string | null;
  }>;
  rules: PriceRule[];
}

/**
 * Fetch active product base price, variant prices, and volume discount rules with currency conversion
 */
export async function fetchProductPrice(
  productId: string,
  currency = "USD",
  priceListCode?: string,
): Promise<ProductPricingDetails | null> {
  try {
    const url = new URL(`${BASE}/products/${productId}`);
    url.searchParams.set("currency", currency);
    if (priceListCode) {
      url.searchParams.set("priceListCode", priceListCode);
    }

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn(
      `[PricingService] Could not fetch pricing for product ${productId}:`,
      err,
    );
    return null;
  }
}

/**
 * Request an authoritative price quote with volume tiers & promotion deduction
 */
export async function fetchPriceQuote(
  input: PriceQuoteRequest,
  authToken?: string,
): Promise<PriceQuote> {
  const res = await fetch(`${BASE}/quote`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to calculate price quote (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Request multiple price quotes in a batch
 */
export async function fetchBulkPriceQuote(
  input: BulkPriceQuoteRequest,
  authToken?: string,
): Promise<PriceQuote[]> {
  const res = await fetch(`${BASE}/bulk-quote`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to calculate bulk price quotes (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.quotes || [];
}

/**
 * Fetch active supported currency exchange rates
 */
export async function fetchCurrencyRates(): Promise<CurrencyRate[]> {
  try {
    const res = await fetch(`${BASE}/currencies`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.rates || [];
  } catch (err) {
    console.warn(
      "[PricingService] Could not fetch currency exchange rates:",
      err,
    );
    return [];
  }
}
