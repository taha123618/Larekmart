import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Conversations
// ==============================================================================
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    type: varchar("type", { length: 32 }).notNull().default("DIRECT_BUYER_SELLER"), // DIRECT_BUYER_SELLER, SUPPORT_TICKET, ORDER_INQUIRY, ADMIN_BROADCAST
    title: varchar("title", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // ACTIVE, ARCHIVED, CLOSED
    sellerId: varchar("seller_id", { length: 128 }),
    orderId: varchar("order_id", { length: 128 }),
    ticketId: varchar("ticket_id", { length: 128 }),
    createdById: varchar("created_by_id", { length: 128 }).notNull(),
    lastMessageId: varchar("last_message_id", { length: 64 }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_type_idx").on(table.type),
    index("conversations_status_idx").on(table.status),
    index("conversations_seller_id_idx").on(table.sellerId),
    index("conversations_order_id_idx").on(table.orderId),
    index("conversations_ticket_id_idx").on(table.ticketId),
    index("conversations_created_by_id_idx").on(table.createdById),
    index("conversations_last_message_at_idx").on(table.lastMessageAt),
  ],
);

// ==============================================================================
// 2. Conversation Participants
// ==============================================================================
export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 64 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 128 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("BUYER"), // BUYER, SELLER, SUPPORT_AGENT, ADMIN, SYSTEM
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    isMuted: boolean("is_muted").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("conversation_participants_conv_user_idx").on(
      table.conversationId,
      table.userId,
    ),
    index("conversation_participants_user_id_idx").on(table.userId),
    index("conversation_participants_role_idx").on(table.role),
  ],
);

// ==============================================================================
// 3. Messages
// ==============================================================================
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 64 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id", { length: 128 }).notNull(),
    senderRole: varchar("sender_role", { length: 32 })
      .notNull()
      .default("BUYER"),
    messageType: varchar("message_type", { length: 32 })
      .notNull()
      .default("TEXT"), // TEXT, IMAGE, FILE, PRODUCT_CARD, ORDER_CARD, SYSTEM_NOTICE
    content: text("content").notNull(),
    replyToMessageId: varchar("reply_to_message_id", { length: 64 }),
    isEdited: boolean("is_edited").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    isReported: boolean("is_reported").notNull().default(false),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_sender_id_idx").on(table.senderId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_reply_to_idx").on(table.replyToMessageId),
    index("messages_is_reported_idx").on(table.isReported),
  ],
);

// ==============================================================================
// 4. Message Receipts
// ==============================================================================
export const messageReceipts = pgTable(
  "message_receipts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    messageId: varchar("message_id", { length: 64 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("SENT"), // SENT, DELIVERED, READ
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("message_receipts_msg_user_idx").on(table.messageId, table.userId),
    index("message_receipts_user_id_idx").on(table.userId),
    index("message_receipts_status_idx").on(table.status),
  ],
);

// ==============================================================================
// 5. Message Attachments
// ==============================================================================
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    messageId: varchar("message_id", { length: 64 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    mediaFileId: varchar("media_file_id", { length: 128 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("message_attachments_message_id_idx").on(table.messageId),
    index("message_attachments_media_file_id_idx").on(table.mediaFileId),
  ],
);

// ==============================================================================
// 6. Conversation Blocks (Moderation / Anti-Abuse)
// ==============================================================================
export const conversationBlocks = pgTable(
  "conversation_blocks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    blockerUserId: varchar("blocker_user_id", { length: 128 }).notNull(),
    blockedUserId: varchar("blocked_user_id", { length: 128 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversation_blocks_pair_idx").on(
      table.blockerUserId,
      table.blockedUserId,
    ),
    index("conversation_blocks_blocker_idx").on(table.blockerUserId),
    index("conversation_blocks_blocked_idx").on(table.blockedUserId),
  ],
);
