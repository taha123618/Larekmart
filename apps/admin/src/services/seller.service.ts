/**
 * seller.service.ts — Admin client for seller-service (:8021) via API Gateway (:8090).
 */

import type {
  SellerStatus,
  SellerStore,
  SellerPolicy,
  SellerStaff,
  SellerSettings,
  SellerPerformanceSnapshot,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_SELLER_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const ADMIN_BASE = `${API_BASE}/api/v1/admin/sellers`;

export interface AdminSellerListItem {
  id: string;
  vendorId: string;
  ownerUserId: string;
  status: SellerStatus;
  primaryCurrency: string;
  onboardedAt?: string | null;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  store?: SellerStore | null;
  policies?: SellerPolicy[];
  staff?: SellerStaff[];
  settings?: SellerSettings | null;
  latestPerformance?: SellerPerformanceSnapshot | null;
}

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
 * Fetch all sellers with optional status/vendor filtering
 */
export async function fetchAdminSellers(
  params?: {
    status?: string;
    vendorId?: string;
    limit?: number;
    offset?: number;
  },
  authToken?: string,
): Promise<{ sellers: AdminSellerListItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.vendorId) query.set("vendorId", params.vendorId);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const url = `${ADMIN_BASE}${query.toString() ? `?${query.toString()}` : ""}`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sellers (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { sellers: data, total: data.length };
  }
  return data;
}

/**
 * Fetch single seller with store profile, policies, staff, and performance
 */
export async function fetchAdminSellerDetails(
  id: string,
  authToken?: string,
): Promise<AdminSellerListItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch seller details (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.seller;
}

/**
 * Transition seller status (e.g. ACTIVE, SUSPENDED, TERMINATED)
 */
export async function updateAdminSellerStatus(
  id: string,
  input: {
    status: SellerStatus;
    reason: string;
  },
  authToken?: string,
): Promise<AdminSellerListItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}/status`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to update seller status (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.seller;
}

/**
 * Fetch historical performance snapshots for seller
 */
export async function fetchAdminSellerPerformance(
  id: string,
  limit = 10,
  authToken?: string,
): Promise<SellerPerformanceSnapshot[]> {
  const res = await fetch(`${ADMIN_BASE}/${id}/performance?limit=${limit}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch seller performance (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.snapshots || [];
}

/**
 * Record a manual performance snapshot
 */
export async function recordAdminSellerPerformance(
  id: string,
  input: {
    periodStart: string;
    periodEnd: string;
    totalOrders: number;
    fulfilledOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    grossMerchandiseValue: number;
    averageRating: number;
    fulfillmentRate: number;
    onTimeDeliveryRate: number;
    cancellationRate: number;
    returnRate: number;
    sellerScore: number;
  },
  authToken?: string,
): Promise<SellerPerformanceSnapshot> {
  const res = await fetch(`${ADMIN_BASE}/${id}/performance`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to record performance (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.snapshot;
}
