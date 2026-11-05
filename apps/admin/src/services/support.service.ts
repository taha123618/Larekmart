/**
 * support.service.ts — Admin client service for managing customer/seller support tickets,
 * agent queues, SLA policies, escalations, and resolution analytics.
 */

import type {
  Ticket,
  TicketMessage,
  TicketCategory,
  TicketSlaPolicy,
  TicketFilterInput,
  AssignTicketInput,
  EscalateTicketInput,
  AddTicketMessageInput,
  TicketStatus,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const SUPPORT_BASE = `${API_BASE}/api/v1/support`;
const ADMIN_SUPPORT_BASE = `${API_BASE}/api/v1/admin/support`;

function getHeaders(authToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface SupportAnalytics {
  totalTickets: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  teamBreakdown: Record<string, number>;
  slaMetrics: {
    totalResolved: number;
    breachedCount: number;
    slaBreachRatePercentage: number;
    avgFirstResponseTimeMinutes: number;
    avgResolutionTimeMinutes: number;
  };
  agentWorkload: Array<{
    agentId: string;
    activeTickets: number;
  }>;
}

/**
 * Fetch support tickets with filter options
 */
export async function fetchAdminTickets(
  filter?: Partial<TicketFilterInput>,
  authToken?: string | null,
): Promise<{ total: number; items: Ticket[] }> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.priority) params.set("priority", filter.priority);
  if (filter?.categoryCode) params.set("categoryCode", filter.categoryCode);
  if (filter?.assignedAgentId)
    params.set("assignedAgentId", filter.assignedAgentId);
  if (filter?.isEscalated !== undefined)
    params.set("isEscalated", String(filter.isEscalated));
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
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to fetch tickets (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return {
    total: json.total || 0,
    items: json.items || [],
  };
}

/**
 * Fetch ticket details including messages, assignments, and audit history
 */
export async function fetchTicketById(
  id: string,
  authToken?: string | null,
): Promise<Ticket> {
  const res = await fetch(`${SUPPORT_BASE}/tickets/${id}`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to fetch ticket ${id} (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Assign a ticket to an agent or specialized support team
 */
export async function assignTicket(
  id: string,
  input: AssignTicketInput,
  authToken?: string | null,
): Promise<{ ticket: Ticket; assignment: Record<string, unknown> }> {
  const res = await fetch(`${ADMIN_SUPPORT_BASE}/tickets/${id}/assign`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to assign ticket (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Escalate a ticket with reasons, target team, and adjusted priority
 */
export async function escalateTicket(
  id: string,
  input: EscalateTicketInput,
  authToken?: string | null,
): Promise<Ticket> {
  const res = await fetch(`${ADMIN_SUPPORT_BASE}/tickets/${id}/escalate`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to escalate ticket (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Post a public reply or internal staff note to a ticket
 */
export async function postTicketMessage(
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
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to post message (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Update ticket status (e.g. RESOLVED, CLOSED)
 */
export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  authToken?: string | null,
): Promise<Ticket> {
  const res = await fetch(`${SUPPORT_BASE}/tickets/${id}`, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to update ticket status (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch resolution analytics, SLA compliance, and agent workloads
 */
export async function fetchSupportAnalytics(
  authToken?: string | null,
): Promise<SupportAnalytics> {
  const res = await fetch(`${ADMIN_SUPPORT_BASE}/analytics`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to fetch support analytics (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch configured SLA policies
 */
export async function fetchSlaPolicies(
  authToken?: string | null,
): Promise<TicketSlaPolicy[]> {
  const res = await fetch(`${ADMIN_SUPPORT_BASE}/sla-policies`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to fetch SLA policies (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch active support categories
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
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to fetch support categories (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}
