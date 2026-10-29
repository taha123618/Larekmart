/**
 * dispute.service.ts — Customer & Merchant Storefront Dispute Service
 */

import type {
  DisputeResponse,
  DisputesOverview,
  CreateDisputeInput,
  SubmitRebuttalInput,
  DisputeStatus,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();

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
 * Buyer opens a dispute against an order
 */
export async function createDispute(
  input: CreateDisputeInput,
  authToken?: string,
): Promise<DisputeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/disputes`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create dispute (${res.status})`,
    );
  }

  return res.json();
}

/**
 * List disputes filed by the authenticated customer
 */
export async function fetchBuyerDisputes(
  orderId?: string,
  authToken?: string,
): Promise<{ disputes: DisputeResponse[]; total: number }> {
  const params = new URLSearchParams();
  if (orderId) params.append("orderId", orderId);

  const url = `${API_BASE}/api/v1/disputes${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch disputes (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch detailed dispute with full timeline
 */
export async function fetchDisputeDetails(
  disputeId: string,
  authToken?: string,
): Promise<DisputeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/disputes/${disputeId}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch dispute details (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Customer cancels their dispute
 */
export async function cancelDispute(
  disputeId: string,
  authToken?: string,
): Promise<DisputeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/disputes/${disputeId}/cancel`, {
    method: "POST",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to cancel dispute (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Merchant / Seller lists disputes filed on their products
 */
export async function fetchVendorDisputes(
  vendorId: string,
  status?: DisputeStatus,
  page = 1,
  limit = 20,
  authToken?: string,
): Promise<{ disputes: DisputeResponse[]; total: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (status) params.append("status", status);

  const res = await fetch(
    `${API_BASE}/api/v1/vendors/${vendorId}/disputes?${params.toString()}`,
    {
      headers: getHeaders(authToken),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch vendor disputes (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Merchant overview statistics of active disputes and frozen balances
 */
export async function fetchVendorDisputesOverview(
  vendorId: string,
  authToken?: string,
): Promise<DisputesOverview> {
  const res = await fetch(
    `${API_BASE}/api/v1/vendors/${vendorId}/disputes/overview`,
    {
      headers: getHeaders(authToken),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch dispute overview (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Seller submits formal rebuttal defense and proof
 */
export async function submitSellerRebuttal(
  vendorId: string,
  disputeId: string,
  input: SubmitRebuttalInput,
  authToken?: string,
): Promise<DisputeResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/vendors/${vendorId}/disputes/${disputeId}/rebuttal`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(input),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to submit rebuttal (${res.status})`,
    );
  }

  return res.json();
}
