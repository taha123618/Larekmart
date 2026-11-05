import { db, pool } from "./connection.js";
import {
  conversations,
  conversationParticipants,
  messages,
  messageReceipts,
} from "./schema.js";
import { eq } from "drizzle-orm";

export async function seedChatData(): Promise<void> {
  console.log("Seeding chat data into larekmart_chat_db...");

  const seedConversations = [
    {
      conversation: {
        id: "c1000000-0000-0000-0000-000000000001",
        type: "DIRECT_BUYER_SELLER",
        title: "Trail Boot Size & Fit Inquiry",
        status: "ACTIVE",
        sellerId: "seller_marketplace_42",
        orderId: null,
        ticketId: null,
        createdById: "cust_usr_test_001",
        lastMessageId: "m1000000-0000-0000-0000-000000000002",
        lastMessageAt: new Date(Date.now() - 3600000),
        metadata: { productId: "102", productName: "Trail Boot" },
      },
      participants: [
        {
          id: "cp100000-0000-0000-0000-000000000001",
          conversationId: "c1000000-0000-0000-0000-000000000001",
          userId: "cust_usr_test_001",
          role: "BUYER",
          lastReadAt: new Date(),
          unreadCount: 0,
        },
        {
          id: "cp100000-0000-0000-0000-000000000002",
          conversationId: "c1000000-0000-0000-0000-000000000001",
          userId: "user_seller_apex_01",
          role: "SELLER",
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      ],
      messages: [
        {
          id: "m1000000-0000-0000-0000-000000000001",
          conversationId: "c1000000-0000-0000-0000-000000000001",
          senderId: "cust_usr_test_001",
          senderRole: "BUYER",
          messageType: "TEXT",
          content: "Hi! Are these Trail Boots true to size, or should I order a half size larger for thick socks?",
          createdAt: new Date(Date.now() - 7200000),
        },
        {
          id: "m1000000-0000-0000-0000-000000000002",
          conversationId: "c1000000-0000-0000-0000-000000000001",
          senderId: "user_seller_apex_01",
          senderRole: "SELLER",
          messageType: "TEXT",
          content: "Hello! They fit true to size, but if you plan to wear heavyweight hiking socks, going half a size up is recommended.",
          createdAt: new Date(Date.now() - 3600000),
        },
      ],
    },
    {
      conversation: {
        id: "c1000000-0000-0000-0000-000000000002",
        type: "SUPPORT_TICKET",
        title: "Live Support: Order #ORD-9912 Tracking Delay",
        status: "ACTIVE",
        sellerId: "seller_marketplace_42",
        orderId: "ORD-9912",
        ticketId: "TKT-2026-72490",
        createdById: "cust_usr_test_001",
        lastMessageId: "m1000000-0000-0000-0000-000000000004",
        lastMessageAt: new Date(Date.now() - 1800000),
        metadata: { ticketNumber: "TKT-2026-72490" },
      },
      participants: [
        {
          id: "cp100000-0000-0000-0000-000000000003",
          conversationId: "c1000000-0000-0000-0000-000000000002",
          userId: "cust_usr_test_001",
          role: "BUYER",
          lastReadAt: new Date(),
          unreadCount: 0,
        },
        {
          id: "cp100000-0000-0000-0000-000000000004",
          conversationId: "c1000000-0000-0000-0000-000000000002",
          userId: "agent_support_001",
          role: "SUPPORT_AGENT",
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      ],
      messages: [
        {
          id: "m1000000-0000-0000-0000-000000000003",
          conversationId: "c1000000-0000-0000-0000-000000000002",
          senderId: "cust_usr_test_001",
          senderRole: "BUYER",
          messageType: "TEXT",
          content: "Hi Support, my order #ORD-9912 tracking hasn't updated in 3 days. Can you check?",
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          id: "m1000000-0000-0000-0000-000000000004",
          conversationId: "c1000000-0000-0000-0000-000000000002",
          senderId: "agent_support_001",
          senderRole: "SUPPORT_AGENT",
          messageType: "TEXT",
          content: "Hello! I checked with our carrier dispatcher. The parcel is currently at the Karachi central sorting hub and is scheduled for out-for-delivery by tomorrow morning.",
          createdAt: new Date(Date.now() - 1800000),
        },
      ],
    },
  ];

  for (const item of seedConversations) {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, item.conversation.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(conversations).values(item.conversation);
      for (const p of item.participants) {
        await db.insert(conversationParticipants).values(p);
      }
      for (const m of item.messages) {
        await db.insert(messages).values(m);
        await db.insert(messageReceipts).values({
          id: `r-${m.id}`,
          messageId: m.id,
          userId: m.senderId,
          status: "READ",
          readAt: new Date(),
        });
      }
      console.log(`  ✓ Seeded conversation: ${item.conversation.title} (${item.conversation.id})`);
    } else {
      console.log(`  ℹ Conversation already exists: ${item.conversation.id}`);
    }
  }

  console.log("Chat seeding completed successfully.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedChatData()
    .catch((err) => {
      console.error("Chat seed failed:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
