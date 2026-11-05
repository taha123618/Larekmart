import { v4 as uuidv4 } from "uuid";
import { eq, and, desc, asc, lt, gt } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  conversations,
  conversationParticipants,
  messages,
  messageReceipts,
  messageAttachments,
  conversationBlocks,
} from "../db/schema.js";
import {
  SendMessageDto,
  MessageFilterDto,
  ReportMessageDto,
  BlockUserDto,
} from "@repo/types";
import {
  publishChatMessageCreated,
  publishChatMessageReported,
} from "../kafka/producer.js";
import { ConversationService } from "./conversation.service.js";

export class MessageService {
  /**
   * Sends a message into a conversation.
   */
  static async sendMessage(
    senderUserId: string,
    senderRole: string,
    dto: SendMessageDto,
  ) {
    // 1. Verify membership
    const isParticipant = await ConversationService.isParticipant(
      dto.conversationId,
      senderUserId,
    );
    if (!isParticipant) {
      if (senderRole === "admin") {
        // Staff intervention: automatically register as administrative participant
        await db
          .insert(conversationParticipants)
          .values({
            id: uuidv4(),
            conversationId: dto.conversationId,
            userId: senderUserId,
            role: "ADMIN",
            unreadCount: 0,
          })
          .onConflictDoNothing();
      } else {
        throw new Error("Forbidden: You are not a participant in this conversation.");
      }
    }

    // 2. Fetch conversation
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, dto.conversationId))
      .limit(1);

    if (!conv) {
      throw new Error("Conversation not found.");
    }

    if (conv.status === "CLOSED") {
      throw new Error("Cannot send messages: This conversation is closed.");
    }

    // 3. Fetch other participants to check blocks
    const participants = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, dto.conversationId));

    for (const p of participants) {
      if (p.userId !== senderUserId) {
        const blocked = await ConversationService.isBlocked(senderUserId, p.userId);
        if (blocked) {
          throw new Error("Cannot send message: A participant has blocked communication.");
        }
      }
    }

    // 4. Insert message
    const messageId = uuidv4();
    const role =
      senderRole === "seller"
        ? "SELLER"
        : senderRole === "admin"
        ? "ADMIN"
        : "BUYER";

    const [createdMsg] = await db
      .insert(messages)
      .values({
        id: messageId,
        conversationId: dto.conversationId,
        senderId: senderUserId,
        senderRole: role,
        messageType: dto.messageType || "TEXT",
        content: dto.content,
        replyToMessageId: dto.replyToMessageId || null,
        metadata: dto.metadata || {},
      })
      .returning();

    // 5. Insert attachments if provided
    if (dto.attachments && dto.attachments.length > 0) {
      for (const att of dto.attachments) {
        await db.insert(messageAttachments).values({
          id: uuidv4(),
          messageId,
          mediaFileId: att.mediaFileId,
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
        });
      }
    }

    // 6. Update conversation last message timestamp & increment unread counts
    await db
      .update(conversations)
      .set({
        lastMessageId: messageId,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, dto.conversationId));

    for (const p of participants) {
      if (p.userId !== senderUserId) {
        const [part] = await db
          .select({ unreadCount: conversationParticipants.unreadCount })
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversationId, dto.conversationId),
              eq(conversationParticipants.userId, p.userId),
            ),
          )
          .limit(1);

        await db
          .update(conversationParticipants)
          .set({ unreadCount: (part?.unreadCount || 0) + 1 })
          .where(
            and(
              eq(conversationParticipants.conversationId, dto.conversationId),
              eq(conversationParticipants.userId, p.userId),
            ),
          );
      }
    }

    // 7. Publish to Kafka
    const recipientUserIds = participants
      .map((p) => p.userId)
      .filter((uid) => uid !== senderUserId);

    await publishChatMessageCreated({
      messageId,
      conversationId: dto.conversationId,
      conversationType: conv.type as any,
      senderId: senderUserId,
      senderRole: role as any,
      content: dto.content,
      messageType: (dto.messageType || "TEXT") as any,
      recipientUserIds,
      sellerId: conv.sellerId || undefined,
      ticketId: conv.ticketId || undefined,
      orderId: conv.orderId || undefined,
      createdAt: new Date().toISOString(),
    });

    return createdMsg;
  }

  /**
   * Fetches paginated messages for a conversation.
   */
  static async listMessages(
    conversationId: string,
    userId: string,
    filter: MessageFilterDto,
    isAdmin = false,
  ) {
    if (!isAdmin) {
      const isParticipant = await ConversationService.isParticipant(
        conversationId,
        userId,
      );
      if (!isParticipant) {
        throw new Error("Forbidden: You are not a participant in this conversation.");
      }
    }

    const conditions = [eq(messages.conversationId, conversationId)];
    if (filter.beforeMessageId) {
      const [beforeMsg] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, filter.beforeMessageId))
        .limit(1);

      if (beforeMsg) {
        conditions.push(lt(messages.createdAt, beforeMsg.createdAt));
      }
    }
    if (filter.afterMessageId) {
      const [afterMsg] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, filter.afterMessageId))
        .limit(1);

      if (afterMsg) {
        conditions.push(gt(messages.createdAt, afterMsg.createdAt));
      }
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.createdAt))
      .limit(filter.limit);

    // Attach receipts and media attachments
    const enriched = await Promise.all(
      rows.map(async (msg) => {
        const atts = await db
          .select()
          .from(messageAttachments)
          .where(eq(messageAttachments.messageId, msg.id));

        const receipts = await db
          .select()
          .from(messageReceipts)
          .where(eq(messageReceipts.messageId, msg.id));

        return {
          ...msg,
          attachments: atts,
          receipts,
        };
      }),
    );

    return {
      messages: enriched,
      total: rows.length,
    };
  }

  /**
   * Marks messages in a conversation as read by a user.
   */
  static async markAsRead(
    conversationId: string,
    userId: string,
    messageId?: string,
  ) {
    const isParticipant = await ConversationService.isParticipant(
      conversationId,
      userId,
    );
    if (!isParticipant) {
      throw new Error("Forbidden: You are not a participant in this conversation.");
    }

    // Reset unread count for this participant
    await db
      .update(conversationParticipants)
      .set({
        unreadCount: 0,
        lastReadAt: new Date(),
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      );

    // Record receipt if messageId is passed
    if (messageId) {
      await db
        .insert(messageReceipts)
        .values({
          id: uuidv4(),
          messageId,
          userId,
          status: "READ",
          readAt: new Date(),
        })
        .onConflictDoNothing();
    }

    return { success: true };
  }

  /**
   * Reports a message for moderation / abuse review.
   */
  static async reportMessage(
    messageId: string,
    reporterUserId: string,
    dto: ReportMessageDto,
  ) {
    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msg) {
      throw new Error("Message not found.");
    }

    if (msg.senderId === reporterUserId) {
      throw new Error("You cannot report your own message.");
    }

    const isParticipant = await ConversationService.isParticipant(
      msg.conversationId,
      reporterUserId,
    );
    if (!isParticipant) {
      throw new Error("Forbidden: You must be a participant in the conversation to report its messages.");
    }

    await db
      .update(messages)
      .set({ isReported: true, updatedAt: new Date() })
      .where(eq(messages.id, messageId));

    const reportId = uuidv4();

    await publishChatMessageReported({
      reportId,
      messageId,
      conversationId: msg.conversationId,
      reporterUserId,
      reportedUserId: msg.senderId,
      reason: dto.reason,
      category: dto.category,
      reportedAt: new Date().toISOString(),
    });

    return { success: true, reportId };
  }

  /**
   * Blocks communication from another user.
   */
  static async blockUser(blockerUserId: string, dto: BlockUserDto) {
    if (blockerUserId === dto.blockedUserId) {
      throw new Error("You cannot block yourself.");
    }

    await db
      .insert(conversationBlocks)
      .values({
        id: uuidv4(),
        blockerUserId,
        blockedUserId: dto.blockedUserId,
        reason: dto.reason || "User initiated block",
      })
      .onConflictDoNothing();

    return { success: true, blockedUserId: dto.blockedUserId };
  }

  /**
   * Unblocks communication with another user.
   */
  static async unblockUser(blockerUserId: string, targetUserId: string) {
    if (blockerUserId === targetUserId) {
      throw new Error("You cannot unblock yourself.");
    }

    await db
      .delete(conversationBlocks)
      .where(
        and(
          eq(conversationBlocks.blockerUserId, blockerUserId),
          eq(conversationBlocks.blockedUserId, targetUserId),
        ),
      );

    return { success: true, unblockedUserId: targetUserId };
  }
}
