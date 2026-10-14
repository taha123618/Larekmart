/**
 * promotion.service.ts — Admin service for managing campaigns, coupons, and budgets via API Gateway.
 */

import type {
  Promotion,
  CreatePromotionInput,
  UpdatePromotionInput,
  CreateCouponInput,
  CouponCode,
  PromotionRedemption,
  PromotionOverviewResponse,
} from "@repo/types";

const PROMOTION_BASE =
  process.env.NEXT_PUBLIC_PROMOTION_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${PROMOTION_BASE}/api/v1/admin/promotions`;

export interface AdminPromotionsQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}

export interface AdminPromotionsResponse {
  items: Promotion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminRedemptionsResponse {
  items: PromotionRedemption[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetch executive overview KPIs for all promotions and campaigns.
 */
export async function fetchAdminPromotionOverview(
  authToken: string,
): Promise<PromotionOverviewResponse> {
  const res = await fetch(`${BASE}/overview`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch promotion overview (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch paginated promotions directory with optional status/type filtering.
 */
export async function fetchAdminPromotions(
  authToken: string,
  params: AdminPromotionsQueryParams = {},
): Promise<AdminPromotionsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.status) query.set("status", params.status);
  if (params.type) query.set("type", params.type);
  if (params.search) query.set("search", params.search);

  const url = `${BASE}?${query.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch promotions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch details of a single promotion including rules, targets, budget, and coupons.
 */
export async function fetchAdminPromotionDetails(
  authToken: string,
  id: string,
): Promise<Promotion> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch promotion ${id} (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.promotion;
}

/**
 * Create a new promotion campaign with rules, targets, and budget.
 */
export async function createAdminPromotion(
  authToken: string,
  input: CreatePromotionInput,
): Promise<Promotion> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create promotion (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.promotion;
}

/**
 * Update an existing promotion campaign.
 */
export async function updateAdminPromotion(
  authToken: string,
  id: string,
  input: UpdatePromotionInput,
): Promise<Promotion> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update promotion (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.promotion;
}

/**
 * Deactivate a promotion campaign immediately.
 */
export async function deactivateAdminPromotion(
  authToken: string,
  id: string,
): Promise<Promotion> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to deactivate promotion (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.promotion;
}

/**
 * Generate a new coupon code under a campaign.
 */
export async function createAdminCoupon(
  authToken: string,
  promotionId: string,
  input: Omit<CreateCouponInput, "promotionId">,
): Promise<CouponCode> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(promotionId)}/coupons`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...input, promotionId }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create coupon (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.coupon;
}

/**
 * Fetch redemptions audit log for a promotion.
 */
export async function fetchAdminRedemptions(
  authToken: string,
  promotionId: string,
  params: { page?: number; limit?: number } = {},
): Promise<AdminRedemptionsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await fetch(
    `${BASE}/${encodeURIComponent(promotionId)}/redemptions?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch redemptions (HTTP ${res.status})`,
    );
  }

  return res.json();
}
