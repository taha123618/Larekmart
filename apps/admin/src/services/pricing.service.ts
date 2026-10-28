/**
 * pricing.service.ts — Admin client for pricing-service (:8019) via API Gateway (:8090).
 */

import type {
  PriceList,
  ProductPrice,
  PriceRule,
  PriceHistory,
  CurrencyRate,
  CreatePriceListInput,
  UpsertProductPriceInput,
  UpdateProductPriceInput,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_PRICING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const ADMIN_BASE = `${API_BASE}/api/v1/admin`;

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
 * Fetch all price lists (B2C, B2B, wholesale)
 */
export async function fetchAdminPriceLists(
  authToken?: string,
): Promise<PriceList[]> {
  const res = await fetch(`${ADMIN_BASE}/price-lists`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch price lists (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.priceLists || [];
}

/**
 * Create a new price list
 */
export async function createAdminPriceList(
  input: CreatePriceListInput,
  authToken?: string,
): Promise<PriceList> {
  const res = await fetch(`${ADMIN_BASE}/price-lists`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to create price list (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Fetch product prices, optionally filtered by priceListId
 */
export async function fetchAdminPrices(
  priceListId?: string,
  authToken?: string,
): Promise<
  Array<ProductPrice & { priceListName?: string; priceListCode?: string }>
> {
  const url = new URL(`${ADMIN_BASE}/prices`);
  if (priceListId) {
    url.searchParams.set("priceListId", priceListId);
  }
  const res = await fetch(url.toString(), {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch product prices (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.prices || [];
}

/**
 * Upsert product base price
 */
export async function upsertAdminProductPrice(
  input: UpsertProductPriceInput,
  authToken?: string,
): Promise<ProductPrice> {
  const res = await fetch(`${ADMIN_BASE}/prices`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to upsert product price (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Patch a specific price record
 */
export async function patchAdminProductPrice(
  priceId: string,
  input: UpdateProductPriceInput,
  authToken?: string,
): Promise<ProductPrice> {
  const res = await fetch(`${ADMIN_BASE}/prices/${priceId}`, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to update product price (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Fetch price audit history
 */
export async function fetchAdminPriceHistory(
  priceId: string,
  authToken?: string,
): Promise<PriceHistory[]> {
  const res = await fetch(`${ADMIN_BASE}/prices/${priceId}/history`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch price history (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.history || [];
}

/**
 * Fetch tiered and volume discount rules
 */
export async function fetchAdminPriceRules(
  priceListId?: string,
  authToken?: string,
): Promise<PriceRule[]> {
  const url = new URL(`${ADMIN_BASE}/prices/rules`);
  if (priceListId) {
    url.searchParams.set("priceListId", priceListId);
  }
  const res = await fetch(url.toString(), {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch price rules (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.rules || [];
}

/**
 * Create a new volume tier or discount rule
 */
export async function createAdminPriceRule(
  input: {
    priceListId: string;
    ruleType: "tier" | "bulk" | "customer_group";
    productId?: string;
    variantId?: string;
    minQuantity: number;
    maxQuantity?: number;
    discountType: "percentage" | "fixed_amount" | "override_price";
    discountValue: number;
    priority?: number;
    validFrom?: string;
    validTo?: string;
    isActive?: boolean;
  },
  authToken?: string,
): Promise<PriceRule> {
  const res = await fetch(`${ADMIN_BASE}/prices/rules`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to create price rule (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Fetch currency exchange rates
 */
export async function fetchAdminCurrencyRates(
  authToken?: string,
): Promise<CurrencyRate[]> {
  const res = await fetch(`${ADMIN_BASE}/prices/currencies`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch currency rates (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.rates || [];
}

/**
 * Upsert currency exchange rate
 */
export async function upsertAdminCurrencyRate(
  input: {
    baseCurrency: string;
    targetCurrency: string;
    exchangeRate: number;
  },
  authToken?: string,
): Promise<CurrencyRate> {
  const res = await fetch(`${ADMIN_BASE}/prices/currencies`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to update currency rate (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Trigger live refresh of currency exchange rates from market feed
 */
export async function refreshAdminCurrencyRates(authToken?: string): Promise<{
  success: boolean;
  refreshedCount: number;
  source: string;
  rates: Record<string, number>;
  refreshedAt: string;
}> {
  const res = await fetch(`${ADMIN_BASE}/prices/currencies/refresh`, {
    method: "POST",
    headers: getHeaders(authToken),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to refresh currency rates (HTTP ${res.status})`,
    );
  }
  return res.json();
}
