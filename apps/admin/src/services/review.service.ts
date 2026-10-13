import type { ReviewStatus } from "@repo/types";

const REVIEW_BASE =
  process.env.NEXT_PUBLIC_REVIEW_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${REVIEW_BASE}/api/v1/admin/reviews`;

export interface AdminReviewItem {
  id: string;
  productId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  title: string | null;
  content: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  unhelpfulCount: number;
  moderationReason: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media?: {
    id: string;
    mediaId: string;
    mediaUrl: string;
    mediaType: string;
    displayOrder: number;
  }[];
}

export interface AdminReviewsListResponse {
  items: AdminReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminReviewReportItem {
  id: string;
  reviewId: string;
  userId: string;
  reason: string;
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reviewContent?: string | null;
  reviewRating?: number | null;
  reviewStatus?: string | null;
  productId?: string | null;
}

export interface AdminReportsListResponse {
  items: AdminReviewReportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminProductRatingSummaryItem {
  productId: string;
  averageRating: number;
  reviewCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  verifiedCount: number;
  lastCalculatedAt: string;
}

export interface AdminSummariesListResponse {
  items: AdminProductRatingSummaryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetch list of reviews with optional status filter for moderation
 */
export async function fetchAdminReviews(
  token: string,
  query?: { status?: string; page?: number; limit?: number },
): Promise<AdminReviewsListResponse | null> {
  const params = new URLSearchParams();
  if (query?.status && query.status !== "ALL") params.set("status", query.status);
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminReviewsListResponse;
  } catch (err) {
    console.error("Failed to fetch admin reviews:", err);
    return null;
  }
}

/**
 * Moderate a review (APPROVE, REJECT, FLAG, ANONYMIZE)
 */
export async function moderateReview(
  reviewId: string,
  action: "APPROVE" | "REJECT" | "FLAG" | "ANONYMIZE",
  reason: string,
  token: string,
): Promise<{ success: boolean; review?: AdminReviewItem; message?: string }> {
  try {
    const res = await fetch(`${BASE}/${reviewId}/moderation`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || "Failed to moderate review",
      };
    }

    const data = await res.json();
    return { success: true, review: data };
  } catch (err: unknown) {
    console.error("Failed to moderate review:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Fetch abuse and spam reports submitted by users
 */
export async function fetchReviewReports(
  token: string,
  query?: { page?: number; limit?: number },
): Promise<AdminReportsListResponse | null> {
  const params = new URLSearchParams();
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  try {
    const res = await fetch(`${BASE}/reports?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminReportsListResponse;
  } catch (err) {
    console.error("Failed to fetch review reports:", err);
    return null;
  }
}

/**
 * Fetch product rating summaries
 */
export async function fetchReviewSummaries(
  token: string,
  query?: { page?: number; limit?: number },
): Promise<AdminSummariesListResponse | null> {
  const params = new URLSearchParams();
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  try {
    const res = await fetch(`${BASE}/summaries?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminSummariesListResponse;
  } catch (err) {
    console.error("Failed to fetch review summaries:", err);
    return null;
  }
}

/**
 * Trigger recalculation of product rating summaries
 */
export async function recalculateReviewSummaries(
  token: string,
  productId?: string,
): Promise<{ success: boolean; recalculatedCount?: number; message?: string }> {
  try {
    const res = await fetch(`${BASE}/summaries/recalculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(productId ? { productId } : {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || "Failed to recalculate summaries",
      };
    }

    const data = await res.json();
    return { success: true, recalculatedCount: data.recalculatedCount };
  } catch (err: unknown) {
    console.error("Failed to recalculate review summaries:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}
