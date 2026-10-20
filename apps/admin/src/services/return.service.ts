/**
 * return.service.ts — Admin service for managing customer returns, inspections, approvals, rejections, and refund retries.
 */

import {
  ReturnStatus,
  ReturnStatusEnum,
} from "@repo/types";

export interface AdminReturnItem {
  id: string;
  returnId: string;
  orderItemId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: string;
  itemDiscount: string;
  proratedTax: string;
  refundSubtotal: string;
  reason: string;
  condition: string;
  customerNote?: string | null;
  createdAt: string;
}

export interface AdminReturnMedia {
  id: string;
  returnId: string;
  mediaId: string;
  url: string;
  mediaType: string;
  uploaderRole: string;
  caption?: string | null;
  createdAt: string;
}

export interface AdminReturnShipment {
  id: string;
  returnId: string;
  carrierName: string;
  trackingNumber: string;
  labelUrl?: string | null;
  isPrepaid: boolean;
  paidBy: string;
  shippingFee: string;
  trackingStatus: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface AdminReturnInspection {
  id: string;
  returnId: string;
  inspectorId: string;
  overallCondition: string;
  disposition: string;
  notes?: string | null;
  inspectedAt: string;
  createdAt: string;
}

export interface AdminReturnRefund {
  id: string;
  returnId: string;
  paymentIntentId: string;
  idempotencyKey: string;
  amount: string;
  taxAmount: string;
  shippingDeduction: string;
  currency: string;
  status: string;
  stripeRefundId?: string | null;
  failureReason?: string | null;
  requestedAt: string;
  completedAt?: string | null;
}

export interface AdminReturnStateTransition {
  id: string;
  returnId: string;
  previousState: string;
  newState: string;
  actorId: string;
  actorRole: string;
  reasonNote?: string | null;
  createdAt: string;
}

export interface AdminReturnRecord {
  id: string;
  orderId: string;
  customerId: string;
  sellerId?: string | null;
  status: ReturnStatus;
  reasonCategory: string;
  customerComments?: string | null;
  subtotalRefund: string;
  taxRefund: string;
  shippingDeduction: string;
  totalRefund: string;
  currency: string;
  policyVersion: string;
  requiresManualReview: boolean;
  autoApproved: boolean;
  deliveredAt?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: AdminReturnItem[];
  media?: AdminReturnMedia[];
  shipments?: AdminReturnShipment[];
  inspections?: AdminReturnInspection[];
  refunds?: AdminReturnRefund[];
  transitions?: AdminReturnStateTransition[];
}

export interface ReturnOverviewKPIs {
  totalReturns: number;
  pendingReview: number;
  awaitingShipment: number;
  inTransitOrReceived: number;
  inInspection: number;
  refundPending: number;
  completed: number;
  rejectedOrCancelled: number;
  totalRefundAmount: number;
}

const RETURN_BASE =
  process.env.NEXT_PUBLIC_RETURN_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const ADMIN_RETURN_BASE = `${RETURN_BASE}/api/v1/admin/returns`;

function getAuthHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * List returns with optional filtering by status, seller, manual review flag, and pagination.
 */
export async function fetchAdminReturns(
  authToken?: string,
  params?: {
    status?: string;
    sellerId?: string;
    requiresManualReview?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<AdminReturnRecord[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.sellerId) query.set("sellerId", params.sellerId);
  if (params?.requiresManualReview !== undefined)
    query.set("requiresManualReview", String(params.requiresManualReview));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const url = `${ADMIN_RETURN_BASE}${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch returns (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.returns || [];
}

/**
 * Fetch detailed record for a specific return, including items, media, shipments, inspections, refunds, and transition audit logs.
 */
export async function fetchAdminReturnDetails(
  returnId: string,
  authToken?: string,
): Promise<AdminReturnRecord> {
  const res = await fetch(`${ADMIN_RETURN_BASE}/${returnId}`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch return details (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.return;
}

/**
 * Approve a return request and optionally trigger generation of a prepaid shipping label.
 */
export async function approveReturn(
  returnId: string,
  options: { providePrepaidLabel?: boolean; notes?: string },
  authToken?: string,
): Promise<{ success: boolean; returnId: string; status: ReturnStatus }> {
  const res = await fetch(`${ADMIN_RETURN_BASE}/${returnId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to approve return (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Reject a return request with a mandatory explanation.
 */
export async function rejectReturn(
  returnId: string,
  rejectionReason: string,
  authToken?: string,
): Promise<{ success: boolean; returnId: string; status: ReturnStatus }> {
  const res = await fetch(`${ADMIN_RETURN_BASE}/${returnId}/reject`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify({ rejectionReason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to reject return (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Record warehouse inspection outcome for returned line items.
 */
export async function recordReturnInspection(
  returnId: string,
  payload: {
    overallCondition: string;
    items: Array<{
      returnItemId: string;
      receivedCondition: string;
      disposition: string;
      notes?: string;
    }>;
    notes?: string;
  },
  authToken?: string,
): Promise<{ success: boolean; returnId: string; inspectionId: string; status: ReturnStatus }> {
  const res = await fetch(`${ADMIN_RETURN_BASE}/${returnId}/inspect`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to record inspection (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retry a failed refund SAGA.
 */
export async function retryReturnRefund(
  returnId: string,
  authToken?: string,
): Promise<{ success: boolean; returnId: string; status: ReturnStatus }> {
  const res = await fetch(`${ADMIN_RETURN_BASE}/${returnId}/refund/retry`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to retry refund (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Compute KPI stats over returns list
 */
export function calculateReturnOverviewKPIs(returns: AdminReturnRecord[]): ReturnOverviewKPIs {
  const kpis: ReturnOverviewKPIs = {
    totalReturns: returns.length,
    pendingReview: 0,
    awaitingShipment: 0,
    inTransitOrReceived: 0,
    inInspection: 0,
    refundPending: 0,
    completed: 0,
    rejectedOrCancelled: 0,
    totalRefundAmount: 0,
  };

  for (const r of returns) {
    switch (r.status) {
      case ReturnStatusEnum.REQUESTED:
      case ReturnStatusEnum.PENDING_REVIEW:
        kpis.pendingReview++;
        break;
      case ReturnStatusEnum.APPROVED:
      case ReturnStatusEnum.AWAITING_RETURN_SHIPMENT:
        kpis.awaitingShipment++;
        break;
      case ReturnStatusEnum.IN_TRANSIT:
      case ReturnStatusEnum.RECEIVED:
        kpis.inTransitOrReceived++;
        break;
      case ReturnStatusEnum.INSPECTION:
      case ReturnStatusEnum.DISPUTED:
        kpis.inInspection++;
        break;
      case ReturnStatusEnum.REFUND_PENDING:
      case ReturnStatusEnum.REFUND_FAILED:
        kpis.refundPending++;
        break;
      case ReturnStatusEnum.COMPLETED:
        kpis.completed++;
        kpis.totalRefundAmount += parseFloat(r.totalRefund || "0");
        break;
      case ReturnStatusEnum.REJECTED:
      case ReturnStatusEnum.CANCELLED:
        kpis.rejectedOrCancelled++;
        break;
    }
  }

  return kpis;
}
