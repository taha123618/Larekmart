/**
 * payment.service.ts — Admin service for payment reconciliation batches and COD collection/remittance lifecycle.
 */

import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const ADMIN_PAYMENTS_BASE = `${API_BASE}/api/v1/admin/payments`;

export interface ReconciliationInputRecord {
  orderId: string;
  expectedAmount: number;
  settledAmount: number;
  currency: string;
  provider: string;
  providerReference: string;
}

export interface ReconciliationResultItem extends ReconciliationInputRecord {
  status: "MATCHED" | "UNDERPAID" | "OVERPAID" | "MISSING_SETTLEMENT";
  discrepancyAmount: number;
  reconciledAt: string;
}

export interface ReconciliationSummaryResponse {
  count: number;
  items: ReconciliationResultItem[];
}

export interface CodCollectionRecord {
  orderId: string;
  courierId: string;
  expectedAmount: number;
  collectedAmount: number;
  remittedAmount: number;
  currency: string;
  status:
    | "PENDING_COLLECTION"
    | "COLLECTED_BY_COURIER"
    | "REMITTED_TO_MARKETPLACE"
    | "DISPUTED";
  collectedAt?: string;
  remittedAt?: string;
  receiptReference?: string;
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

export async function fetchReconciliationSummary(
  authToken?: string,
): Promise<ReconciliationSummaryResponse> {
  const res = await fetch(`${ADMIN_PAYMENTS_BASE}/reconcile/summary`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch payment reconciliation summary");
  }
  return res.json();
}

export async function runPaymentReconciliation(
  records: ReconciliationInputRecord[],
  authToken?: string,
): Promise<{
  items: ReconciliationResultItem[];
  summary: {
    total: number;
    matched: number;
    underpaid: number;
    overpaid: number;
    missingSettlement: number;
    totalDiscrepancy: number;
  };
}> {
  const res = await fetch(`${ADMIN_PAYMENTS_BASE}/reconcile`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to reconcile payment batch",
    );
  }
  return res.json();
}

export async function recordAdminCodCollection(
  payload: {
    orderId: string;
    courierId: string;
    expectedAmount: number;
    collectedAmount: number;
    currency?: string;
    receiptReference?: string;
  },
  authToken?: string,
): Promise<CodCollectionRecord> {
  const res = await fetch(`${ADMIN_PAYMENTS_BASE}/cod/collect`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to record COD collection",
    );
  }
  const data = (await res.json()) as { record: CodCollectionRecord };
  return data.record;
}

export async function remitAdminCodCollection(
  payload: {
    orderId: string;
    remittedAmount: number;
    settlementBatchId: string;
  },
  authToken?: string,
): Promise<CodCollectionRecord> {
  const res = await fetch(`${ADMIN_PAYMENTS_BASE}/cod/remit`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to remit COD collection",
    );
  }
  const data = (await res.json()) as { record: CodCollectionRecord };
  return data.record;
}
