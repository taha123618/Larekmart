/**
 * support.service.ts — Storefront Client Service for Customer Support Tickets
 */

import type {
  Ticket,
  TicketMessage,
  TicketCategory,
  CreateTicketInput,
  AddTicketMessageInput,
  TicketFilterInput,
  AiSupportResponse,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const SUPPORT_BASE = `${API_BASE}/api/v1/support`;

function getHeaders(authToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Fetch customer's own support tickets
 */
export async function fetchMyTickets(
  filter?: Partial<TicketFilterInput>,
  authToken?: string | null,
): Promise<{ total: number; items: Ticket[] }> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.priority) params.set("priority", filter.priority);
  if (filter?.orderId) params.set("orderId", filter.orderId);
  if (filter?.search) params.set("search", filter.search);
  if (filter?.limit) params.set("limit", String(filter.limit));
  if (filter?.offset) params.set("offset", String(filter.offset));

  const qs = params.toString();
  const url = `${SUPPORT_BASE}/tickets${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch support tickets (${res.status})`,
    );
  }

  const json = await res.json();
  return {
    total: json.total || 0,
    items: json.items || [],
  };
}

/**
 * Fetch detailed ticket with message timeline (internal notes are redacted)
 */
export async function fetchMyTicketById(
  id: string,
  authToken?: string | null,
): Promise<Ticket> {
  const res = await fetch(`${SUPPORT_BASE}/tickets/${id}`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch ticket ${id} (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Create a new customer support ticket
 */
export async function createSupportTicket(
  input: CreateTicketInput,
  authToken?: string | null,
): Promise<Ticket> {
  const res = await fetch(`${SUPPORT_BASE}/tickets`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create support ticket (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Add a customer reply to an open support ticket
 */
export async function addTicketReply(
  id: string,
  input: AddTicketMessageInput,
  authToken?: string | null,
): Promise<TicketMessage> {
  const res = await fetch(`${SUPPORT_BASE}/tickets/${id}/messages`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to post message (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch available support categories
 */
export async function fetchSupportCategories(
  authToken?: string | null,
): Promise<TicketCategory[]> {
  const res = await fetch(`${SUPPORT_BASE}/categories`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch support categories (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Ask AI Support Assistant for instant guidance & FAQ responses
 */
export async function askAiSupportAssistant(
  message: string,
  context?: { orderId?: string; productId?: string; category?: string },
): Promise<AiSupportResponse> {
  const res = await fetch(`${API_BASE}/api/v1/support/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `AI Support Assistant error (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}
