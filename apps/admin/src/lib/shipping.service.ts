import type {
  Shipment,
  ShippingRate,
  ShippingMethod,
  TrackingResult,
  ShippingLabel,
} from "@repo/types";

const SHIPPING_BASE =
  process.env.NEXT_PUBLIC_SHIPPING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${SHIPPING_BASE}/api/v1`;

export interface ShipmentListResponse {
  shipments: Shipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ShipmentFilterParams {
  page?: number;
  limit?: number;
  carrier?: string;
  status?: string;
  search?: string;
  isCod?: boolean;
  codStatus?: string;
}

export async function fetchShipments(
  params: ShipmentFilterParams = {},
): Promise<ShipmentListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.carrier && params.carrier !== "all")
    query.set("carrier", params.carrier);
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.isCod !== undefined) query.set("isCod", String(params.isCod));
  if (params.codStatus && params.codStatus !== "all")
    query.set("codStatus", params.codStatus);

  try {
    const res = await fetch(`${BASE}/shipments?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        shipments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
    return (await res.json()) as ShipmentListResponse;
  } catch (err) {
    console.warn("Failed to fetch shipments:", err);
    return {
      shipments: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }
}

export async function fetchShipmentById(id: string): Promise<Shipment | null> {
  try {
    const res = await fetch(`${BASE}/shipments/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Shipment;
  } catch {
    return null;
  }
}

export async function fetchShipmentTracking(
  id: string,
): Promise<TrackingResult | null> {
  try {
    const res = await fetch(`${BASE}/shipments/${id}/tracking`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TrackingResult;
  } catch {
    return null;
  }
}

export async function cancelShipment(
  id: string,
  reason?: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${BASE}/shipments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: "Failed to cancel" }));
      return { success: false, message: err.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function generateShipmentLabel(
  id: string,
  format: "pdf" | "zpl" | "png" = "pdf",
): Promise<ShippingLabel | null> {
  try {
    const res = await fetch(`${BASE}/shipments/${id}/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ShippingLabel;
  } catch {
    return null;
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

export async function calculateShippingRates(params: {
  city: string;
  country?: string;
  weight?: number;
}): Promise<ShippingRate[]> {
  const query = new URLSearchParams();
  query.set("city", params.city);
  query.set("country", params.country ?? "PK");
  if (params.weight) query.set("weight", String(params.weight));

  try {
    const res = await fetch(`${BASE}/shipping/rates?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rates ?? [];
  } catch {
    return [];
  }
}
