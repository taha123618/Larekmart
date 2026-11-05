import { z } from "zod";

// ==============================================================================
// 1. Chat Enums
// ==============================================================================

export const ConversationTypeEnum = z.enum([
  "DIRECT_BUYER_SELLER",
  "SUPPORT_TICKET",
  "ORDER_INQUIRY",
  "ADMIN_BROADCAST",
]);
export type ConversationType = z.infer<typeof ConversationTypeEnum>;

export const ConversationStatusEnum = z.enum(["ACTIVE", "ARCHIVED", "CLOSED"]);
export type ConversationStatus = z.infer<typeof ConversationStatusEnum>;

export const ParticipantRoleEnum = z.enum([
  "BUYER",
  "SELLER",
  "SUPPORT_AGENT",
  "ADMIN",
  "SYSTEM",
]);
export type ParticipantRole = z.infer<typeof ParticipantRoleEnum>;

export const MessageTypeEnum = z.enum([
  "TEXT",
  "IMAGE",
  "FILE",
  "PRODUCT_CARD",
  "ORDER_CARD",
  "SYSTEM_NOTICE",
]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

export const ReceiptStatusEnum = z.enum(["SENT", "DELIVERED", "READ"]);
export type ReceiptStatus = z.infer<typeof ReceiptStatusEnum>;

// ==============================================================================
// 2. Chat Zod Schemas
// ==============================================================================

export const ChatAttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  mediaFileId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(128),
});
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

export const CreateConversationSchema = z.object({
  type: ConversationTypeEnum.default("DIRECT_BUYER_SELLER"),
  title: z.string().min(1).max(255).optional(),
  sellerId: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  ticketId: z.string().min(1).optional(),
  participantUserIds: z.array(z.string().min(1)).min(1),
  initialMessage: z.string().min(1).max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  messageType: MessageTypeEnum.default("TEXT"),
  content: z.string().min(1).max(4000),
  replyToMessageId: z.string().uuid().optional(),
  attachments: z.array(ChatAttachmentSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const MarkReadSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
});
export type MarkReadDto = z.infer<typeof MarkReadSchema>;

export const ReportMessageSchema = z.object({
  reason: z.string().min(5).max(500),
  category: z.enum([
    "SPAM",
    "HARASSMENT",
    "SCAM_OR_FRAUD",
    "INAPPROPRIATE_CONTENT",
    "OTHER",
  ]),
});
export type ReportMessageDto = z.infer<typeof ReportMessageSchema>;

export const BlockUserSchema = z.object({
  blockedUserId: z.string().min(1),
  reason: z.string().max(255).optional(),
});
export type BlockUserDto = z.infer<typeof BlockUserSchema>;

export const ConversationFilterSchema = z.object({
  type: ConversationTypeEnum.optional(),
  status: ConversationStatusEnum.optional(),
  sellerId: z.string().optional(),
  ticketId: z.string().optional(),
  orderId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ConversationFilterDto = z.infer<typeof ConversationFilterSchema>;

export const MessageFilterSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  beforeMessageId: z.string().uuid().optional(),
  afterMessageId: z.string().uuid().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type MessageFilterDto = z.infer<typeof MessageFilterSchema>;

// Aliases for unified feature service client signatures
export type CreateConversationInput = CreateConversationDto;
export type SendMessageInput = SendMessageDto;
export type MarkReadInput = MarkReadDto;
export type ReportMessageInput = ReportMessageDto;
export type BlockUserInput = BlockUserDto;
export type ConversationFilterInput = ConversationFilterDto;
export type MessageFilterInput = MessageFilterDto;

// ==============================================================================
// 3. Domain Entity Interfaces
// ==============================================================================

export interface ChatAttachmentItem {
  id: string;
  messageId?: string;
  mediaFileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt?: string | Date;
}
export type MessageAttachment = ChatAttachmentItem;

export interface ChatParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  lastReadAt?: string | Date | null;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  joinedAt: string | Date;
  leftAt?: string | Date | null;
}
export type ConversationParticipant = ChatParticipant;

export interface ChatMessageReceipt {
  id: string;
  messageId: string;
  userId: string;
  status: ReceiptStatus;
  deliveredAt?: string | Date | null;
  readAt?: string | Date | null;
  createdAt: string | Date;
}
export type MessageReceipt = ChatMessageReceipt;

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: ParticipantRole;
  messageType: MessageType;
  content: string;
  replyToMessageId?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  isReported: boolean;
  metadata?: Record<string, unknown> | null;
  attachments?: ChatAttachmentItem[];
  receipts?: ChatMessageReceipt[];
  createdAt: string | Date;
  updatedAt: string | Date;
}
export type Message = ChatMessage;

export interface ChatConversation {
  id: string;
  type: ConversationType;
  title?: string | null;
  status: ConversationStatus;
  sellerId?: string | null;
  orderId?: string | null;
  ticketId?: string | null;
  createdById: string;
  lastMessageId?: string | null;
  lastMessageAt?: string | Date | null;
  lastMessagePreview?: string | null;
  metadata?: Record<string, unknown> | null;
  participants?: ChatParticipant[];
  createdAt: string | Date;
  updatedAt: string | Date;
}
export type Conversation = ChatConversation;

export interface ChatConversationBlock {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason?: string | null;
  createdAt: string | Date;
}
export type ConversationBlock = ChatConversationBlock;

// ==============================================================================
// 4. Socket.IO Real-Time Event Contracts
// ==============================================================================

export interface SocketJoinConversationPayload {
  conversationId: string;
}

export interface SocketLeaveConversationPayload {
  conversationId: string;
}

export interface SocketSendMessagePayload {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  replyToMessageId?: string;
  attachments?: ChatAttachment[];
  metadata?: Record<string, unknown>;
}

export interface SocketTypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export interface SocketPresencePayload {
  userId: string;
  status: "ONLINE" | "OFFLINE" | "AWAY";
  lastSeenAt: string;
}

export interface SocketMessageReadPayload {
  conversationId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// ==============================================================================
// 4. Kafka Event Topics & Payloads
// ==============================================================================

export const CHAT_KAFKA_TOPICS = {
  MESSAGE_CREATED: "chat.message.created",
  MESSAGE_REPORTED: "chat.message.reported",
  CONVERSATION_CREATED: "chat.conversation.created",
} as const;

export interface ChatMessageCreatedEvent {
  messageId: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  senderRole: ParticipantRole;
  content: string;
  messageType: MessageType;
  recipientUserIds: string[];
  sellerId?: string;
  ticketId?: string;
  orderId?: string;
  createdAt: string;
}

export interface ChatMessageReportedEvent {
  reportId: string;
  messageId: string;
  conversationId: string;
  reporterUserId: string;
  reportedUserId: string;
  reason: string;
  category: string;
  reportedAt: string;
}

export interface ChatConversationCreatedEvent {
  conversationId: string;
  type: ConversationType;
  createdById: string;
  participantUserIds: string[];
  sellerId?: string;
  ticketId?: string;
  orderId?: string;
  createdAt: string;
}
