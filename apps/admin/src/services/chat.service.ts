/**
 * chat.service.ts — Admin Management Service for Live Support Monitoring & Chat Moderation
 */

import type {
  Conversation,
  Message,
  ConversationFilterInput,
  MessageFilterInput,
  ReportMessageInput,
  BlockUserInput,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const CHAT_BASE = `${API_BASE}/api/v1/chat`;

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
 * Fetch all conversations for administrative oversight
 */
export async function fetchAdminConversations(
  filter?: Partial<ConversationFilterInput>,
  authToken?: string | null,
): Promise<{ total: number; items: Conversation[] }> {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.ticketId) params.set("ticketId", filter.ticketId);
  if (filter?.orderId) params.set("orderId", filter.orderId);
  if (filter?.sellerId) params.set("sellerId", filter.sellerId);
  if (filter?.search) params.set("search", filter.search);
  if (filter?.limit) params.set("limit", String(filter.limit));
  if (filter?.offset) params.set("offset", String(filter.offset));

  const qs = params.toString();
  const url = `${CHAT_BASE}/conversations${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch admin conversations (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch details of any conversation as an administrator
 */
export async function fetchAdminConversationById(
  conversationId: string,
  authToken?: string | null,
): Promise<Conversation> {
  const res = await fetch(`${CHAT_BASE}/conversations/${conversationId}`, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch conversation (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch message transcripts for moderation/audit
 */
export async function fetchAdminConversationMessages(
  conversationId: string,
  filter?: Partial<MessageFilterInput>,
  authToken?: string | null,
): Promise<{ total: number; items: Message[] }> {
  const params = new URLSearchParams();
  if (filter?.limit) params.set("limit", String(filter.limit));
  const beforeVal = filter?.beforeMessageId || filter?.before;
  if (beforeVal) params.set("beforeMessageId", beforeVal);
  const afterVal = filter?.afterMessageId || filter?.after;
  if (afterVal) params.set("afterMessageId", afterVal);

  const qs = params.toString();
  const url = `${CHAT_BASE}/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch conversation messages (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Admin action: send staff reply or resolution note
 */
export async function sendAdminMessage(
  conversationId: string,
  content: string,
  authToken?: string | null,
): Promise<Message> {
  const res = await fetch(`${CHAT_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({
      content,
      messageType: "TEXT",
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to send staff message (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Block abusive account system-wide
 */
export async function blockAbusiveUser(
  targetUserId: string,
  reason: string,
  authToken?: string | null,
): Promise<{ success: boolean }> {
  const res = await fetch(`${CHAT_BASE}/users/${targetUserId}/block`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ blockedUserId: targetUserId, reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to block user (${res.status})`,
    );
  }

  return res.json();
}
