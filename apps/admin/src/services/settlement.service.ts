/**
 * settlement.service.ts — Admin client service for marketplace escrow balances, batch generation & automated payout execution.
 */

import type { VendorSettlementOverview, PayoutBatch } from "@repo/types";
import { getServiceUrl } from "./gateway.service";

const API_BASE = getServiceUrl(process.env.NEXT_PUBLIC_VENDOR_SERVICE_URL);

const ADMIN_SETTLEMENTS_BASE = `${API_BASE}/api/v1/admin/settlements`;

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
 * Fetch platform-wide aggregate escrow and settlement liabilities
 */
export async function fetchSettlementOverview(
  token?: string,
): Promise<VendorSettlementOverview> {
  const res = await fetch(`${ADMIN_SETTLEMENTS_BASE}/overview`, {
    headers: getHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch settlement overview (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.overview;
}

export interface AdminPayoutBatchListItem extends PayoutBatch {
  requestCount?: number;
}

/**
 * List historical and pending payout disbursement batches
 */
export async function fetchPayoutBatches(
  token?: string,
): Promise<AdminPayoutBatchListItem[]> {
  const res = await fetch(`${ADMIN_SETTLEMENTS_BASE}/batches`, {
    headers: getHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch payout batches (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.batches || [];
}

/**
 * Trigger generation of a new consolidated payout batch for all eligible vendors
 */
export async function generatePayoutBatch(
  token?: string,
): Promise<PayoutBatch> {
  const res = await fetch(`${ADMIN_SETTLEMENTS_BASE}/batches/generate`, {
    method: "POST",
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to generate payout batch (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  return data.batch;
}

/**
 * Approve and execute automated disbursements for a payout batch
 */
export async function approvePayoutBatch(
  batchId: string,
  transactionReference?: string,
  token?: string,
): Promise<{ success: boolean; batchId: string; disbursedCount: number }> {
  const res = await fetch(
    `${ADMIN_SETTLEMENTS_BASE}/batches/${batchId}/approve`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ transactionReference }),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to approve payout batch (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Administratively freeze escrow funds for an order transaction
 */
export async function freezeEscrow(
  escrowId: string,
  reason: string,
  token?: string,
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${ADMIN_SETTLEMENTS_BASE}/escrow/${escrowId}/freeze`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to freeze escrow (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Unfreeze previously held escrow funds
 */
export async function unfreezeEscrow(
  escrowId: string,
  token?: string,
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${ADMIN_SETTLEMENTS_BASE}/escrow/${escrowId}/unfreeze`,
    {
      method: "POST",
      headers: getHeaders(token),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to unfreeze escrow (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Manually trigger the scheduled sweeper to mature eligible escrow funds
 */
export async function sweepMaturedEscrow(
  token?: string,
): Promise<{ releasedCount: number }> {
  const res = await fetch(`${ADMIN_SETTLEMENTS_BASE}/escrow/sweep-matured`, {
    method: "POST",
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to sweep matured escrow (HTTP ${res.status})`,
    );
  }

  return res.json();
}
