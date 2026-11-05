/**
 * chat.service.ts — Storefront Client Service for Real-Time Buyer-to-Seller & Live Support Chat
 */

import type {
  Conversation,
  Message,
  CreateConversationInput,
  SendMessageInput,
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
 * Fetch customer's conversations
 */
export async function fetchMyConversations(
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
      errorData.message || `Failed to fetch conversations (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch a single conversation by ID
 */
export async function fetchConversationById(
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
 * Create a new conversation (Buyer to Seller or Live Support)
 */
export async function createConversation(
  payload: CreateConversationInput,
  authToken?: string | null,
): Promise<Conversation> {
  const res = await fetch(`${CHAT_BASE}/conversations`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create conversation (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch messages for a conversation
 */
export async function fetchConversationMessages(
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
      errorData.message || `Failed to fetch messages (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Send a message into a conversation
 */
export async function sendMessage(
  conversationId: string,
  payload: Omit<SendMessageInput, "conversationId">,
  authToken?: string | null,
): Promise<Message> {
  const res = await fetch(`${CHAT_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to send message (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Mark messages in conversation as read
 */
export async function markConversationRead(
  conversationId: string,
  messageId?: string,
  authToken?: string | null,
): Promise<{ success: boolean; unreadCount: number }> {
  const res = await fetch(
    `${CHAT_BASE}/conversations/${conversationId}/messages/read`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify({ messageId }),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to mark read (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Report an abusive message
 */
export async function reportMessage(
  messageId: string,
  payload: ReportMessageInput,
  authToken?: string | null,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${CHAT_BASE}/messages/${messageId}/report`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to report message (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Block a user from direct messaging
 */
export async function blockUser(
  targetUserId: string,
  payload: BlockUserInput,
  authToken?: string | null,
): Promise<{ success: boolean; block: any }> {
  const res = await fetch(`${CHAT_BASE}/users/${targetUserId}/block`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to block user (${res.status})`,
    );
  }

  return res.json();
}
