/**
 * payout.service.ts — Client service for merchant double-entry ledger balance, automated payout history, and statements.
 */

import type {
  SellerBalanceResponse,
  PayoutRecord,
  PayoutExecutionStatus,
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

export interface ClientSellerPayoutItem {
  id: string;
  batchId?: string | null;
  sellerId: string;
  amount: string | number;
  currency: string;
  status: PayoutExecutionStatus;
  providerReference?: string | null;
  failureReason?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ClientSellerPayoutListResponse {
  sellerId: string;
  payouts: ClientSellerPayoutItem[];
}

export interface ClientSellerMonthlyStatement {
  id: string;
  sellerId: string;
  period: string; // e.g. "2026-10"
  openingBalance: number;
  netCredits: number;
  commissionsWithheld: number;
  payoutsTransferred: number;
  closingBalance: number;
  statementUrl?: string;
}

export interface ClientSellerStatementListResponse {
  sellerId: string;
  statements: ClientSellerMonthlyStatement[];
}

/**
 * Fetch real-time balanced double-entry ledger balance for the authenticated seller
 */
export async function fetchSellerBalance(
  authToken?: string,
): Promise<SellerBalanceResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sellers/me/balance`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch seller balance (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch historical & scheduled payouts for the authenticated seller
 */
export async function fetchSellerPayouts(
  authToken?: string,
): Promise<ClientSellerPayoutListResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sellers/me/payouts`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch seller payouts (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch monthly financial statements for the authenticated seller
 */
export async function fetchSellerStatements(
  authToken?: string,
): Promise<ClientSellerStatementListResponse> {
  const res = await fetch(`${API_BASE}/api/v1/sellers/me/statements`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch statements (HTTP ${res.status})`,
    );
  }

  return res.json();
}
