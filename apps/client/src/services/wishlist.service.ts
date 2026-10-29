/**
 * wishlist.service.ts — Storefront client for wishlist-service (:8015) via API Gateway (:8090).
 */

import type {
  Wishlist,
  WishlistItem,
  WishlistShare,
  CreateWishlistInput,
  UpdateWishlistInput,
  AddWishlistItemInput,
  MoveWishlistItemInput,
  MergeWishlistInput,
  CreateShareTokenInput,
  BulkRemoveItemsInput,
  SharedWishlistResponse,
} from "@repo/types";
import { getOrCreateGuestToken } from "./cart.service";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();

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

export interface WishlistWithItemsResponse {
  wishlist: Wishlist;
  items: WishlistItem[];
}

/**
 * Fetch all wishlists owned by the authenticated customer.
 */
export async function fetchMyWishlists(
  authToken?: string,
): Promise<{ wishlists: Wishlist[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists`, {
    headers: getHeaders(authToken),
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

/**
 * Fetch a single wishlist by ID including all saved items.
 */
export async function fetchWishlistById(
  wishlistId: string,
  authToken?: string,
): Promise<WishlistWithItemsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists/${wishlistId}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new custom named wishlist (e.g. "Favorites", "Holiday Ideas").
 */
export async function createWishlist(
  data: CreateWishlistInput,
  authToken?: string,
): Promise<Wishlist> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Update wishlist metadata (name, visibility, default flag).
 */
export async function updateWishlist(
  wishlistId: string,
  data: UpdateWishlistInput,
  authToken?: string,
): Promise<Wishlist> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists/${wishlistId}`, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Delete a custom wishlist.
 */
export async function deleteWishlist(
  wishlistId: string,
  authToken?: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists/${wishlistId}`, {
    method: "DELETE",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to delete wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Add a product or variant to a wishlist.
 */
export async function addItemToWishlist(
  wishlistId: string,
  data: AddWishlistItemInput,
  authToken?: string,
): Promise<WishlistItem> {
  const res = await fetch(
    `${API_BASE}/api/v1/me/wishlists/${wishlistId}/items`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
      `Failed to add item to wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Remove an item from a wishlist.
 */
export async function removeItemFromWishlist(
  wishlistId: string,
  itemId: string,
  authToken?: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/me/wishlists/${wishlistId}/items/${itemId}`,
    {
      method: "DELETE",
      headers: getHeaders(authToken),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
      `Failed to remove item from wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Bulk remove multiple items from a wishlist.
 */
export async function bulkRemoveWishlistItems(
  wishlistId: string,
  data: BulkRemoveItemsInput,
  authToken?: string,
): Promise<{ success: boolean; removedCount: number }> {
  const res = await fetch(
    `${API_BASE}/api/v1/me/wishlists/${wishlistId}/items`,
    {
      method: "DELETE",
      headers: getHeaders(authToken),
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to bulk remove items (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Move an item from one wishlist to another wishlist.
 */
export async function moveWishlistItem(
  wishlistId: string,
  data: MoveWishlistItemInput,
  authToken?: string,
): Promise<WishlistItem> {
  const res = await fetch(
    `${API_BASE}/api/v1/me/wishlists/${wishlistId}/items/move`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to move item (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Merge guest wishlist items into user account upon sign-in.
 */
export async function mergeGuestWishlist(
  data: MergeWishlistInput,
  authToken: string,
): Promise<{ mergedCount: number; targetWishlistId: string }> {
  const res = await fetch(`${API_BASE}/api/v1/me/wishlists/merge`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
      `Failed to merge guest wishlist (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create an unguessable share token for a wishlist.
 */
export async function createWishlistShareToken(
  wishlistId: string,
  data: CreateShareTokenInput,
  authToken: string,
): Promise<WishlistShare> {
  const res = await fetch(
    `${API_BASE}/api/v1/me/wishlists/${wishlistId}/share`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create share token (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Public resolver for a shared wishlist by token.
 */
export async function fetchSharedWishlist(
  shareToken: string,
): Promise<SharedWishlistResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/shared-wishlists/${encodeURIComponent(shareToken)}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Shared wishlist not found (HTTP ${res.status})`,
    );
  }

  return res.json();
}
