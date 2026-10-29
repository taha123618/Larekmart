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
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();

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

export interface AdminSystemSettings {
  id: string;
  isSellerEnabled: boolean;
  isSellerRegistrationOpen: boolean;
  isStorefrontsActive: boolean;
  maintenanceMessage?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export type UpdateAdminSystemSettingsInput = {
  isSellerEnabled?: boolean;
  isSellerRegistrationOpen?: boolean;
  isStorefrontsActive?: boolean;
  maintenanceMessage?: string;
};

/**
 * Fetch platform-wide marketplace system settings (Public or Admin)
 */
export async function fetchSystemSettings(
  authToken?: string,
): Promise<AdminSystemSettings> {
  const url = `${API_BASE}/api/v1/system-settings`;
  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch system settings (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Update platform-wide marketplace system settings (Super Admin only)
 */
export async function updateSystemSettings(
  input: boolean | UpdateAdminSystemSettingsInput,
  authToken?: string,
): Promise<{
  message: string;
  settings: AdminSystemSettings;
}> {
  const payload =
    typeof input === "boolean" ? { isSellerEnabled: input } : input;
  const url = `${API_BASE}/api/v1/admin/system-settings`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message ||
        `Failed to update system settings (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Fetch all active Manage Admin delegations (Super Admin only)
 */
export async function fetchAdminDelegations(authToken?: string): Promise<
  Array<{
    id: string;
    adminUserId: string;
    permission: string;
    grantedByUserId: string;
    createdAt: string;
  }>
> {
  const url = `${API_BASE}/api/v1/admin/delegations`;
  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch admin delegations (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.delegations || [];
}

/**
 * Grant Manage Admin delegation to an administrator (Super Admin only)
 */
export async function grantAdminDelegation(
  adminUserId: string,
  authToken?: string,
): Promise<{
  message: string;
  delegation: {
    id: string;
    adminUserId: string;
    permission: string;
    grantedByUserId: string;
    createdAt: string;
  };
}> {
  const url = `${API_BASE}/api/v1/admin/delegations`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ adminUserId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to grant delegation (HTTP ${res.status})`,
    );
  }
  return res.json();
}

/**
 * Revoke Manage Admin delegation from an administrator (Super Admin only)
 */
export async function revokeAdminDelegation(
  adminUserId: string,
  authToken?: string,
): Promise<{ message: string; adminUserId: string }> {
  const url = `${API_BASE}/api/v1/admin/delegations/${adminUserId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: getHeaders(authToken),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to revoke delegation (HTTP ${res.status})`,
    );
  }
  return res.json();
}
