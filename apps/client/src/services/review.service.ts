/**
 * review.service.ts — Storefront client for review-service (:8014) via API Gateway (:8090).
 */

import type {
  Review,
  ProductRatingSummary,
  CreateReviewInput,
  VoteType,
  ReportReason,
  ReviewSortOption,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();

export interface PaginatedReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewQueryParams {
  page?: number;
  limit?: number;
  sort?: ReviewSortOption;
  rating?: number;
  verifiedOnly?: boolean;
  hasMedia?: boolean;
}

/**
 * Fetch paginated reviews for a specific product.
 */
export async function fetchProductReviews(
  productId: string,
  params: ReviewQueryParams = {},
): Promise<PaginatedReviewsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.sort) query.set("sort", params.sort);
  if (params.rating) query.set("rating", String(params.rating));
  if (params.verifiedOnly) query.set("verifiedOnly", "true");
  if (params.hasMedia) query.set("hasMedia", "true");

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(
    `${API_BASE}/api/v1/products/${encodeURIComponent(productId)}/reviews${qs}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch reviews (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch real-time rating summary (average score, total reviews, star breakdown) for a product.
 */
export async function fetchProductRatingSummary(
  productId: string,
): Promise<ProductRatingSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/products/${encodeURIComponent(productId)}/rating-summary`,
      { cache: "no-store" },
    );

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Submit a customer product review. Strictly requires customer authentication token.
 */
export async function submitProductReview(
  productId: string,
  payload: CreateReviewInput,
  token?: string | null,
): Promise<Review> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE}/api/v1/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || `Review submission failed (HTTP ${res.status})`,
    );
  }

  return data;
}

/**
 * Cast a helpful or unhelpful vote on an existing review.
 */
export async function voteProductReview(
  reviewId: string,
  voteType: VoteType,
  token?: string | null,
): Promise<{ success: boolean; helpfulCount: number; unhelpfulCount: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE}/api/v1/reviews/${encodeURIComponent(reviewId)}/votes`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ voteType }),
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || `Failed to record vote (HTTP ${res.status})`,
    );
  }

  return data;
}

/**
 * Report an inappropriate review for moderation.
 */
export async function reportProductReview(
  reviewId: string,
  reason: ReportReason,
  details?: string,
  token?: string | null,
): Promise<{ success: boolean; message: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE}/api/v1/reviews/${encodeURIComponent(reviewId)}/reports`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ reason, details }),
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || `Failed to report review (HTTP ${res.status})`,
    );
  }

  return data;
}
