/**
 * promotion.service.ts — Storefront client for promotion-service (:8016) via API Gateway (:8090).
 */

import type {
  Promotion,
  PromotionQuoteInput,
  PromotionQuoteResponse,
  ValidateCouponInput,
  ValidateCouponResponse,
  CreateReservationInput,
  PromotionReservation,
} from "@repo/types";
import { getOrCreateGuestToken } from "./cart.service";

const API_BASE =
  process.env.NEXT_PUBLIC_PROMOTION_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${API_BASE}/api/v1/promotions`;

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
 * Fetch all currently active campaigns and promotions.
 */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  const res = await fetch(`${BASE}/active`, {
    headers: getHeaders(),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch active promotions (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.promotions ?? [];
}

/**
 * Evaluate promotions and coupons for the current shopping cart.
 */
export async function getPromotionQuote(
  input: PromotionQuoteInput,
  authToken?: string,
): Promise<PromotionQuoteResponse> {
  const res = await fetch(`${BASE}/quote`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to calculate promotion quote (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Validate a single coupon code with cart items.
 */
export async function validateCouponCode(
  input: ValidateCouponInput,
  authToken?: string,
): Promise<ValidateCouponResponse> {
  const res = await fetch(`${BASE}/validate-coupon`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to validate coupon (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Reserve a promotion and hold budget during checkout.
 */
export async function reservePromotion(
  input: CreateReservationInput,
  authToken?: string,
): Promise<PromotionReservation> {
  const res = await fetch(`${BASE}/reservations`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to reserve promotion (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.reservation;
}

/**
 * Release a promotion reservation on checkout failure or cancellation.
 */
export async function releasePromotionReservation(
  reservationId: string,
  reason?: string,
  authToken?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/reservations/${encodeURIComponent(reservationId)}/release`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ reason }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.warn(`Failed to release promotion reservation: ${errorData.message || res.statusText}`);
  }
}
