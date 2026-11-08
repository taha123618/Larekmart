import { v4 as uuidv4 } from "uuid";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  conversations,
  conversationParticipants,
  messages,
  conversationBlocks,
} from "../db/schema.js";
import {
  CreateConversationDto,
  ConversationFilterDto,
} from "@repo/types";
import { publishChatConversationCreated } from "../kafka/producer.js";

export class ConversationService {
  /**
   * Verifies whether two users have blocked each other.
   */
  static async isBlocked(userA: string, userB: string): Promise<boolean> {
    const blocks = await db
      .select({ id: conversationBlocks.id })
      .from(conversationBlocks)
      .where(
        sql`(${conversationBlocks.blockerUserId} = ${userA} AND ${conversationBlocks.blockedUserId} = ${userB}) OR (${conversationBlocks.blockerUserId} = ${userB} AND ${conversationBlocks.blockedUserId} = ${userA})`,
      )
      .limit(1);

    return blocks.length > 0;
  }

  /**
   * Verifies if a user is an active participant in a conversation.
   */
  static async isParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);

    return participant.length > 0;
  }

  /**
   * Retrieves all active conversation IDs for a user to scope presence broadcasts.
   */
  static async getUserConversationIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    return rows.map((r) => r.conversationId);
  }

  /**
   * Creates a new conversation with participants and optional initial message.
   */
  static async createConversation(
    creatorUserId: string,
    creatorRole: string,
    dto: CreateConversationDto,
  ) {
    const conversationId = uuidv4();
    const participantUserIds = Array.from(
      new Set([creatorUserId, ...dto.participantUserIds]),
    );

    const distinctOtherParticipants = dto.participantUserIds.filter(
      (id) => id !== creatorUserId,
    );
    if (distinctOtherParticipants.length === 0 && creatorRole !== "admin") {
      throw new Error("A conversation must include at least one other participant.");
    }

    // Check if blocked by any recipient
    for (const recipientId of dto.participantUserIds) {
      if (recipientId !== creatorUserId) {
        const blocked = await this.isBlocked(creatorUserId, recipientId);
        if (blocked) {
          throw new Error("Cannot initiate conversation: Communication is blocked between participants.");
        }
      }
    }

    const title =
      dto.title ||
      (dto.type === "SUPPORT_TICKET"
        ? `Support Case #${dto.ticketId || "General"}`
        : "Marketplace Inquiry");

    // Insert conversation
    const [conv] = await db
      .insert(conversations)
      .values({
        id: conversationId,
        type: dto.type || "DIRECT_BUYER_SELLER",
        title,
        status: "ACTIVE",
        sellerId: dto.sellerId || null,
        orderId: dto.orderId || null,
        ticketId: dto.ticketId || null,
        createdById: creatorUserId,
        metadata: dto.metadata || {},
      })
      .returning();

    // Insert participants
    for (const uid of participantUserIds) {
      const role =
        uid === creatorUserId
          ? creatorRole === "seller"
            ? "SELLER"
            : creatorRole === "admin"
            ? "ADMIN"
            : "BUYER"
          : dto.sellerId && uid.includes("seller")
          ? "SELLER"
          : "BUYER";

      await db.insert(conversationParticipants).values({
        id: uuidv4(),
        conversationId,
        userId: uid,
        role,
        unreadCount: 0,
      });
    }

    // Optional initial message
    if (dto.initialMessage) {
      const msgId = uuidv4();
      await db.insert(messages).values({
        id: msgId,
        conversationId,
        senderId: creatorUserId,
        senderRole: creatorRole === "seller" ? "SELLER" : "BUYER",
        messageType: "TEXT",
        content: dto.initialMessage,
      });

      await db
        .update(conversations)
        .set({
          lastMessageId: msgId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
    }

    // Publish Kafka Event
    await publishChatConversationCreated({
      conversationId,
      type: dto.type || "DIRECT_BUYER_SELLER",
      createdById: creatorUserId,
      participantUserIds,
      sellerId: dto.sellerId,
      ticketId: dto.ticketId,
      orderId: dto.orderId,
      createdAt: new Date().toISOString(),
    });

    return conv;
  }

  /**
   * Lists conversations for a user with unread counts and latest messages.
   */
  static async listUserConversations(
    userId: string,
    filter: ConversationFilterDto,
    isAdmin = false,
  ) {
    let items;
    let participationMap = new Map<string, any>();

    if (isAdmin) {
      const conditions = [];
      if (filter.type) {
        conditions.push(eq(conversations.type, filter.type));
      }
      if (filter.status) {
        conditions.push(eq(conversations.status, filter.status));
      }
      if (filter.sellerId) {
        conditions.push(eq(conversations.sellerId, filter.sellerId));
      }
      if (filter.ticketId) {
        conditions.push(eq(conversations.ticketId, filter.ticketId));
      }

      items = await db
        .select()
        .from(conversations)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
        .limit(filter.limit)
        .offset(filter.offset);
    } else {
      // 1. Fetch conversation IDs user belongs to
      const participations = await db
        .select({
          conversationId: conversationParticipants.conversationId,
          role: conversationParticipants.role,
          unreadCount: conversationParticipants.unreadCount,
          lastReadAt: conversationParticipants.lastReadAt,
        })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, userId));

      if (participations.length === 0) {
        return { conversations: [], total: 0 };
      }

      const convIds = participations.map((p) => p.conversationId);
      participationMap = new Map(participations.map((p) => [p.conversationId, p]));

      const conditions = [inArray(conversations.id, convIds)];
      if (filter.type) {
        conditions.push(eq(conversations.type, filter.type));
      }
      if (filter.status) {
        conditions.push(eq(conversations.status, filter.status));
      }
      if (filter.sellerId) {
        conditions.push(eq(conversations.sellerId, filter.sellerId));
      }
      if (filter.ticketId) {
        conditions.push(eq(conversations.ticketId, filter.ticketId));
      }

      items = await db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
        .limit(filter.limit)
        .offset(filter.offset);
    }

    // Attach participants & unread details
    const result = await Promise.all(
      items.map(async (conv) => {
        const parts = await db
          .select({
            userId: conversationParticipants.userId,
            role: conversationParticipants.role,
          })
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, conv.id));

        const userPart = participationMap.get(conv.id);

        return {
          ...conv,
          participants: parts,
          unreadCount: userPart?.unreadCount || 0,
          myRole: userPart?.role || (isAdmin ? "ADMIN" : "BUYER"),
        };
      }),
    );

    return {
      conversations: result,
      total: items.length,
    };
  }

  /**
   * Fetches full conversation details by ID, ensuring user is authorized.
   */
  static async getConversationById(
    conversationId: string,
    userId: string,
    isAdmin = false,
  ) {
    if (!isAdmin) {
      const isPart = await this.isParticipant(conversationId, userId);
      if (!isPart) {
        throw new Error("Unauthorized: You are not a participant in this conversation.");
      }
    }

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv) {
      return null;
    }

    const parts = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));

    return {
      ...conv,
      participants: parts,
    };
  }
}
