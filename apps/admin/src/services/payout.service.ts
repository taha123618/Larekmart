/**
 * payout.service.ts — Admin service for automated payout batches, ledger audits, and disbursement retries.
 */

import type { PayoutRecord, PayoutExecutionStatus } from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const ADMIN_PAYOUTS_BASE = `${API_BASE}/api/v1/admin/payouts`;

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface AdminPayoutListResponse {
  total: number;
  payouts: Array<
    PayoutRecord & {
      id: string;
      batchId?: string | null;
      sellerId: string;
      accountId: string;
      amount: string | number;
      currency: string;
      status: PayoutExecutionStatus;
      providerReference?: string | null;
      failureReason?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
      createdAt?: string;
    }
  >;
}

/**
 * Fetch all payout disbursements across batches
 */
export async function fetchAdminPayouts(
  authToken?: string,
): Promise<AdminPayoutListResponse> {
  const res = await fetch(ADMIN_PAYOUTS_BASE, {
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
 * Retry a failed payout disbursement
 */
export async function retryAdminPayout(
  payoutId: string,
  authToken?: string,
): Promise<{ success: boolean; payoutId: string; message: string }> {
  const res = await fetch(`${ADMIN_PAYOUTS_BASE}/${payoutId}/retry`, {
    method: "POST",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to retry payout (HTTP ${res.status})`,
    );
  }

  return res.json();
}
