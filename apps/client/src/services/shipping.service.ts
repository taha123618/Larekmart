import type { ShippingRate, ShippingMethod, TrackingResult } from "@repo/types";

const SHIPPING_BASE =
  process.env.NEXT_PUBLIC_SHIPPING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${SHIPPING_BASE}/api/v1`;

export async function fetchShippingRates(params: {
  city: string;
  country?: string;
  postalCode?: string;
  weight?: number;
  isCod?: boolean;
  codAmount?: number;
}): Promise<ShippingRate[]> {
  const query = new URLSearchParams();
  query.set("city", params.city);
  query.set("country", params.country ?? "PK");
  if (params.postalCode) query.set("postalCode", params.postalCode);
  if (params.weight) query.set("weight", String(params.weight));
  if (params.isCod) query.set("isCod", "true");
  if (params.codAmount) query.set("codAmount", String(params.codAmount));

  try {
    const res = await fetch(`${BASE}/shipping/rates?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rates ?? [];
  } catch (err) {
    console.warn("Failed to fetch shipping rates:", err);
    return [];
  }
}

export async function fetchShippingMethods(): Promise<ShippingMethod[]> {
  try {
    const res = await fetch(`${BASE}/shipping/methods`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.methods ?? [];
  } catch {
    return [];
  }
}

export async function fetchTracking(
  trackingNumber: string,
): Promise<TrackingResult | null> {
  try {
    const res = await fetch(
      `${BASE}/tracking/${encodeURIComponent(trackingNumber)}`,
      {
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as TrackingResult;
  } catch {
    return null;
  }
}
