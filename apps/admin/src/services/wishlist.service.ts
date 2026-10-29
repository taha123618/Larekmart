/**
 * wishlist.service.ts — Admin service for managing and monitoring customer wishlists via API Gateway.
 */

import type { Wishlist } from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const WISHLIST_BASE = getApiGatewayUrl();

const BASE = `${WISHLIST_BASE}/api/v1/admin/wishlists`;

export interface WishlistOverviewStats {
  totalWishlists: number;
  totalSavedItems: number;
  averageItemsPerWishlist: number;
  priceDropAlertsCount: number;
  restockAlertsCount: number;
  topSavedProducts: { productId: string; count: number }[];
}

export interface AdminWishlistItem extends Wishlist {
  itemCount: number;
}

export interface AdminWishlistsResponse {
  items: AdminWishlistItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminWishlistQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchAdminWishlistOverview(
  authToken: string,
): Promise<WishlistOverviewStats> {
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
        `Failed to fetch wishlist overview (HTTP ${res.status})`,
    );
  }

  return res.json();
}

export async function fetchAdminWishlists(
  authToken: string,
  params: AdminWishlistQueryParams = {},
): Promise<AdminWishlistsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${BASE}${qs}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch wishlists (HTTP ${res.status})`,
    );
  }

  return res.json();
}
