/**
 * dispute.service.ts — Admin client service for marketplace dispute arbitration.
 */

import type {
  DisputeResponse,
  DisputesOverview,
  ResolveDisputeInput,
  DisputeStatus,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_VENDOR_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const ADMIN_DISPUTES_BASE = `${API_BASE}/api/v1/admin/disputes`;

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch platform-wide dispute statistics and status counts
 */
export async function fetchAdminDisputesOverview(
  token?: string,
  vendorId?: string,
): Promise<DisputesOverview> {
  const params = new URLSearchParams();
  if (vendorId) params.append("vendorId", vendorId);

  const res = await fetch(
    `${ADMIN_DISPUTES_BASE}/overview${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: getHeaders(token),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch dispute overview (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * List disputes across all vendors and customers with pagination and filtering
 */
export async function fetchAdminDisputes(
  token?: string,
  filters: {
    vendorId?: string;
    buyerId?: string;
    status?: DisputeStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ disputes: DisputeResponse[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.vendorId) params.append("vendorId", filters.vendorId);
  if (filters.buyerId) params.append("buyerId", filters.buyerId);
  if (filters.status) params.append("status", filters.status);
  if (filters.search) params.append("search", filters.search);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.limit) params.append("limit", filters.limit.toString());

  const res = await fetch(
    `${ADMIN_DISPUTES_BASE}${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: getHeaders(token),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch disputes (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch deep dispute record with full audit timeline
 */
export async function fetchAdminDisputeDetails(
  id: string,
  token?: string,
): Promise<DisputeResponse> {
  const res = await fetch(`${ADMIN_DISPUTES_BASE}/${id}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch dispute details (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Platform Admin resolves a dispute (favor buyer or favor seller)
 */
export async function resolveAdminDispute(
  id: string,
  input: ResolveDisputeInput,
  token?: string,
): Promise<DisputeResponse> {
  const res = await fetch(`${ADMIN_DISPUTES_BASE}/${id}/resolve`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to resolve dispute (HTTP ${res.status})`,
    );
  }

  return res.json();
}
