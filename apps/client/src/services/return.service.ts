/**
 * return.service.ts — Customer Return Operations Client
 *
 * Communicates with API Gateway (/api/v1/returns) to power customer self-service returns,
 * partial return requests, condition reporting, tracking submission, and media evidence.
 */

import type {
  ReturnItem,
  ReturnReason,
  ReturnStatus,
  ReturnItemCondition,
} from "@repo/types";

const GATEWAY_BASE =
  process.env.NEXT_PUBLIC_RETURN_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const MEDIA_BASE =
  process.env.NEXT_PUBLIC_MEDIA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

export interface CustomerReturnItem {
  id: string;
  returnId: string;
  orderItemId: string;
  productId: string;
  variantId?: string | null;
  productName?: string;
  productSku?: string;
  quantity: number;
  unitPrice: string;
  discountShare: string;
  taxShare: string;
  refundSubtotal: string;
  reason: ReturnReason;
  condition: ReturnItemCondition;
  customerNote?: string | null;
  inspectionDisposition?: string | null;
}

export interface CustomerReturnEvidence {
  id: string;
  returnId: string;
  mediaId: string;
  url: string;
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT";
  caption?: string | null;
  createdAt: string;
}

export interface CustomerReturnStateTransition {
  id: string;
  returnId: string;
  previousState: ReturnStatus;
  newState: ReturnStatus;
  actorId: string;
  actorRole: "CUSTOMER" | "SELLER" | "ADMIN" | "SYSTEM";
  reasonNote?: string | null;
  createdAt: string;
}

export interface CustomerReturnRecord {
  id: string;
  orderId: string;
  customerId: string;
  sellerId?: string | null;
  status: ReturnStatus;
  reasonCategory: ReturnReason;
  customerComments?: string | null;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  estimatedRefundSubtotal: string;
  estimatedRefundTax: string;
  shippingFeeDeduction: string;
  totalEstimatedRefund: string;
  currency: string;
  prepaidLabelUrl?: string | null;
  returnTrackingNumber?: string | null;
  returnCarrier?: string | null;
  items?: CustomerReturnItem[];
  evidence?: CustomerReturnEvidence[];
  transitions?: CustomerReturnStateTransition[];
  requestedAt: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

/**
 * Fetch the authenticated customer's returns list.
 */
export async function fetchMyReturns(
  token: string,
  options?: { limit?: number; offset?: number },
): Promise<CustomerReturnRecord[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const url = `${GATEWAY_BASE}/api/v1/returns?limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Failed to fetch returns: ${res.status}`);
  }

  const data = (await res.json()) as { returns: CustomerReturnRecord[] };
  return data.returns || [];
}

/**
 * Fetch detailed record of a single return by ID.
 */
export async function fetchReturnById(
  token: string,
  returnId: string,
): Promise<CustomerReturnRecord> {
  const url = `${GATEWAY_BASE}/api/v1/returns/${returnId}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      error.message || `Failed to fetch return details: ${res.status}`,
    );
  }

  const data = (await res.json()) as { return: CustomerReturnRecord };
  return data.return;
}

/**
 * Submit a customer return request for a delivered order.
 */
export async function requestOrderReturn(
  token: string,
  orderId: string,
  payload: {
    items: ReturnItem[];
    reasonCategory: ReturnReason;
    customerComments?: string;
    evidenceMediaIds?: string[];
  },
): Promise<CustomerReturnRecord> {
  const url = `${GATEWAY_BASE}/api/v1/returns/orders/${orderId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Failed to request return: ${res.status}`);
  }

  return (await res.json()) as CustomerReturnRecord;
}

/**
 * Cancel a pending return request (only permitted while in REQUESTED status).
 */
export async function cancelReturnRequest(
  token: string,
  returnId: string,
  reason?: string,
): Promise<CustomerReturnRecord> {
  const url = `${GATEWAY_BASE}/api/v1/returns/${returnId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Failed to cancel return: ${res.status}`);
  }

  return (await res.json()) as CustomerReturnRecord;
}

/**
 * Attach media evidence to a return request.
 */
export async function attachReturnEvidence(
  token: string,
  returnId: string,
  evidence: {
    mediaId: string;
    url: string;
    mediaType: "PHOTO" | "VIDEO" | "DOCUMENT";
    caption?: string;
  },
): Promise<CustomerReturnEvidence> {
  const url = `${GATEWAY_BASE}/api/v1/returns/${returnId}/evidence`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(evidence),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      error.message || `Failed to attach evidence: ${res.status}`,
    );
  }

  return (await res.json()) as CustomerReturnEvidence;
}

/**
 * Customer submits return shipment tracking info.
 */
export async function submitReturnTracking(
  token: string,
  returnId: string,
  tracking: {
    carrierName: string;
    trackingNumber: string;
  },
): Promise<CustomerReturnRecord> {
  const url = `${GATEWAY_BASE}/api/v1/returns/${returnId}/tracking`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tracking),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      error.message || `Failed to submit tracking: ${res.status}`,
    );
  }

  return (await res.json()) as CustomerReturnRecord;
}

/**
 * Helper: upload return evidence file directly via media-service.
 */
export async function uploadReturnPhotoEvidence(
  file: File,
  orderId: string,
  token: string,
): Promise<{ mediaId: string; mediaUrl: string }> {
  // 1. Create upload session
  const createRes = await fetch(`${MEDIA_BASE}/api/v1/media/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ownerType: "return",
      ownerId: orderId,
      filename: file.name,
      contentType: file.type || "image/jpeg",
      size: file.size,
      category: "return_evidence",
      visibility: "PUBLIC",
    }),
  });

  if (!createRes.ok) {
    // If direct media-service isn't accessible, fallback to fake local reference or throw
    const detail = await createRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to create photo upload session");
  }

  const session = (await createRes.json()) as {
    mediaId: string;
    uploadUrl: string;
  };

  // 2. Direct PUT to presigned storage URL
  const putRes = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "image/jpeg" },
  });

  if (!putRes.ok) {
    throw new Error("Direct upload of return photo failed");
  }

  // 3. Mark session complete
  const completeRes = await fetch(
    `${MEDIA_BASE}/api/v1/media/${session.mediaId}/complete`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!completeRes.ok) {
    const detail = await completeRes.json().catch(() => null);
    throw new Error(detail?.message || "Failed to finalize photo upload");
  }

  return {
    mediaId: session.mediaId,
    mediaUrl: `${MEDIA_BASE}/api/v1/media/${session.mediaId}`,
  };
}
