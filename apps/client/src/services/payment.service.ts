/**
 * payment.service.ts — Client service for multi-provider payment intents (Stripe, JazzCash, EasyPaisa, COD)
 * and Cash-on-Delivery (COD) status tracking via API Gateway.
 */

import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const PAYMENTS_BASE = `${API_BASE}/api/v1/payments`;

export type ClientPaymentProvider = "STRIPE" | "JAZZCASH" | "EASYPAISA" | "COD";

export interface PaymentIntentResponse {
  provider: ClientPaymentProvider;
  providerReference: string;
  status: "REQUIRES_ACTION" | "AUTHORIZED" | "CAPTURED" | "PENDING_COLLECTION";
  redirectUrl?: string;
}

export interface CodCollectionStatus {
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

export async function createProviderPaymentIntent(
  payload: {
    provider: ClientPaymentProvider;
    orderId: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  },
  authToken?: string,
): Promise<PaymentIntentResponse> {
  const res = await fetch(`${PAYMENTS_BASE}/providers/intent`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to initialize payment intent",
    );
  }
  return res.json();
}

export async function fetchClientCodOrderStatus(
  orderId: string,
  authToken?: string,
): Promise<CodCollectionStatus | null> {
  const res = await fetch(`${PAYMENTS_BASE}/cod/${encodeURIComponent(orderId)}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error("Failed to fetch COD order status");
  }
  const data = (await res.json()) as { record?: CodCollectionStatus };
  return data.record ?? null;
}
