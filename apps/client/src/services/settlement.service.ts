/**
 * settlement.service.ts — Client service for merchant escrow balance, earnings ledger, and payout requests.
 */

import type {
  VendorBalance,
  VendorEscrowTransaction,
  VendorPayoutRequest,
  RequestPayoutInput,
  EscrowStatus,
  PayoutStatus,
} from "@repo/types";
import { getServiceUrl } from "./gateway.service";

const API_BASE = getServiceUrl(process.env.NEXT_PUBLIC_VENDOR_SERVICE_URL);

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface EscrowListResponse {
  transactions: VendorEscrowTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface PayoutListResponse {
  requests: VendorPayoutRequest[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Fetch authoritative real-time balances for a merchant vendor
 */
export async function fetchVendorBalance(
  vendorId: string,
  authToken?: string,
): Promise<VendorBalance> {
  const res = await fetch(
    `${API_BASE}/api/v1/vendors/${vendorId}/settlements/balance`,
    {
      headers: getHeaders(authToken),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch balance (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.balance;
}

/**
 * Fetch paginated escrow ledger transactions for a merchant vendor
 */
export async function fetchEscrowTransactions(
  vendorId: string,
  options?: { status?: EscrowStatus; page?: number; limit?: number },
  authToken?: string,
): Promise<EscrowListResponse> {
  const query = new URLSearchParams();
  if (options?.status) query.set("status", options.status);
  if (options?.page) query.set("page", options.page.toString());
  if (options?.limit) query.set("limit", options.limit.toString());

  const url = `${API_BASE}/api/v1/vendors/${vendorId}/settlements/escrow${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch escrow transactions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch paginated payout requests and disbursement status
 */
export async function fetchPayoutRequests(
  vendorId: string,
  options?: { status?: PayoutStatus; page?: number; limit?: number },
  authToken?: string,
): Promise<PayoutListResponse> {
  const query = new URLSearchParams();
  if (options?.status) query.set("status", options.status);
  if (options?.page) query.set("page", options.page.toString());
  if (options?.limit) query.set("limit", options.limit.toString());

  const url = `${API_BASE}/api/v1/vendors/${vendorId}/settlements/payouts${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch payouts (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Submit an on-demand payout withdrawal request
 */
export async function requestVendorPayout(
  vendorId: string,
  input: RequestPayoutInput,
  authToken?: string,
): Promise<VendorPayoutRequest> {
  const res = await fetch(
    `${API_BASE}/api/v1/vendors/${vendorId}/settlements/payouts/request`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(input),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to request payout (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.payoutRequest;
}
