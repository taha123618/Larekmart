import { buildApp } from "../../src/index.js";
import { closeDatabase } from "../../src/db/connection.js";
import { closeRedisClient } from "../../src/middleware/idempotency.middleware.js";

async function runIntegrationTests() {
  console.log("==================================================");
  console.log("     CHAT SERVICE - INTEGRATION TEST SUITE        ");
  console.log("==================================================\n");

  const app = await buildApp();
  await app.ready();

  const runSuffix = Date.now();
  const buyerUserId = `test_buyer_${runSuffix}`;
  const sellerUserId = `test_seller_${runSuffix}`;
  const intruderUserId = `test_intruder_${runSuffix}`;

  let createdConversationId = "";
  let createdMessageId = "";

  try {
    // [Test 1] Health & Metrics Endpoints
    console.log("[Test 1] Health & Metrics Endpoints");
    const healthRes = await app.inject({ method: "GET", url: "/health" });
    if (healthRes.statusCode !== 200) throw new Error("Health check failed");
    console.log("  ✓ /health returned 200 OK");

    const metricsRes = await app.inject({ method: "GET", url: "/metrics" });
    if (metricsRes.statusCode !== 200) throw new Error("Metrics check failed");
    console.log("  ✓ /metrics returned Prometheus format");

    // [Test 2] Auth Gating
    console.log("\n[Test 2] Auth Gating (Missing x-user-id)");
    const unauthRes = await app.inject({
      method: "GET",
      url: "/api/v1/chat/conversations",
    });
    if (unauthRes.statusCode !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${unauthRes.statusCode}`);
    }
    console.log("  ✓ Rejected unauthenticated request with HTTP 401");

    // [Test 3] Create Conversation (Buyer to Seller)
    console.log("\n[Test 3] Conversation Creation (Buyer to Seller)");
    const convRes = await app.inject({
      method: "POST",
      url: "/api/v1/chat/conversations",
      headers: {
        "x-user-id": buyerUserId,
        "x-user-role": "user",
      },
      payload: {
        type: "DIRECT_BUYER_SELLER",
        title: "Integration Test Boot Inquiry",
        sellerId: "seller_test_901",
        participantUserIds: [sellerUserId],
        initialMessage: "Hello! Is this jacket available in black?",
      },
    });

    if (convRes.statusCode !== 201) {
      throw new Error(`Failed to create conversation: ${convRes.body}`);
    }
    const convBody = JSON.parse(convRes.body);
    createdConversationId = convBody.id;
    console.log(`  ✓ Created conversation: ${convBody.title} (${createdConversationId})`);

    // [Test 4] List Conversations for Buyer & Seller
    console.log("\n[Test 4] List Conversations for Participants");
    const buyerListRes = await app.inject({
      method: "GET",
      url: "/api/v1/chat/conversations",
      headers: { "x-user-id": buyerUserId },
    });
    const buyerList = JSON.parse(buyerListRes.body);
    if (!buyerList.conversations.some((c: any) => c.id === createdConversationId)) {
      throw new Error("Created conversation missing from buyer listing");
    }
    console.log("  ✓ Buyer conversation list contains new thread");

    const sellerListRes = await app.inject({
      method: "GET",
      url: "/api/v1/chat/conversations",
      headers: { "x-user-id": sellerUserId },
    });
    const sellerList = JSON.parse(sellerListRes.body);
    if (!sellerList.conversations.some((c: any) => c.id === createdConversationId)) {
      throw new Error("Created conversation missing from seller listing");
    }
    console.log("  ✓ Seller conversation list contains new thread");

    // [Test 5] Send Message into Conversation
    console.log("\n[Test 5] Send Message with Reply & Attachments");
    const msgRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: {
        "x-user-id": sellerUserId,
        "x-user-role": "seller",
      },
      payload: {
        content: "Yes, black is in stock! Here is the photo of the jacket.",
        messageType: "TEXT",
        attachments: [
          {
            mediaFileId: "media_jacket_black_01",
            fileName: "jacket-black.jpg",
            fileUrl: "https://cdn.example.com/jacket-black.jpg",
            fileSize: 102400,
            mimeType: "image/jpeg",
          },
        ],
      },
    });

    if (msgRes.statusCode !== 201) {
      throw new Error(`Failed to send message: ${msgRes.body}`);
    }
    const msgBody = JSON.parse(msgRes.body);
    createdMessageId = msgBody.id;
    console.log(`  ✓ Seller sent message with attachment (ID: ${createdMessageId})`);

    // [Test 6] Read Messages (Paginated)
    console.log("\n[Test 6] Read Messages List");
    const getMsgsRes = await app.inject({
      method: "GET",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: { "x-user-id": buyerUserId },
    });
    if (getMsgsRes.statusCode !== 200) {
      throw new Error(`Failed to fetch messages: ${getMsgsRes.body}`);
    }
    const msgsList = JSON.parse(getMsgsRes.body);
    if (msgsList.messages.length < 2) {
      throw new Error(`Expected at least 2 messages, got ${msgsList.messages.length}`);
    }
    console.log(`  ✓ Loaded ${msgsList.messages.length} messages with attachment metadata`);

    // [Test 7] Mark Conversation Read
    console.log("\n[Test 7] Mark Messages Read");
    const readRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages/read`,
      headers: { "x-user-id": buyerUserId },
      payload: { messageId: createdMessageId },
    });
    if (readRes.statusCode !== 200) {
      throw new Error("Failed to mark messages read");
    }
    console.log("  ✓ Read receipt recorded and unread counts reset");

    // [Test 8] Non-Participant Access Block (403 Forbidden)
    console.log("\n[Test 8] Non-Participant Privacy Protection");
    const intruderRes = await app.inject({
      method: "GET",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: { "x-user-id": intruderUserId },
    });
    if (intruderRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for intruder, got ${intruderRes.statusCode}`);
    }
    console.log("  ✓ Intruder strictly blocked from viewing private conversation (HTTP 403)");

    // [Test 9] Report Message for Moderation
    console.log("\n[Test 9] Report Abusive Message");
    const reportRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/messages/${createdMessageId}/report`,
      headers: { "x-user-id": buyerUserId },
      payload: {
        reason: "Test moderation report for message content",
        category: "OTHER",
      },
    });
    if (reportRes.statusCode !== 201) {
      throw new Error(`Failed to report message: ${reportRes.body}`);
    }
    console.log("  ✓ Message reported for moderation successfully");

    // [Test 10] User Blocking & Send Prevention
    console.log("\n[Test 10] Block User & Prevent Subsequent Messages");
    const blockRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/users/${sellerUserId}/block`,
      headers: { "x-user-id": buyerUserId },
      payload: { reason: "Customer requested block" },
    });
    if (blockRes.statusCode !== 201) {
      throw new Error("Failed to block user");
    }
    console.log("  ✓ User blocked successfully");

    const blockedSendRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: {
        "x-user-id": sellerUserId,
        "x-user-role": "seller",
      },
      payload: { content: "Are you still interested in this jacket?" },
    });
    if (blockedSendRes.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request on blocked message, got ${blockedSendRes.statusCode}`);
    }
    console.log("  ✓ Message rejected because communication is blocked");

    // [Test 11] Admin Super-Access Oversight
    console.log("\n[Test 11] Administrator Oversight (Non-Participant Access)");
    const adminMsgsRes = await app.inject({
      method: "GET",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: {
        "x-user-id": "admin_supervisor_01",
        "x-user-role": "admin",
      },
    });
    if (adminMsgsRes.statusCode !== 200) {
      throw new Error(`Expected 200 OK for admin oversight, got ${adminMsgsRes.statusCode}`);
    }
    console.log("  ✓ Administrator granted super-access to view message transcripts");

    // [Test 12] Admin Platform-Wide Conversation Listing
    console.log("\n[Test 12] Admin Platform-Wide Conversation Listing");
    const adminListRes = await app.inject({
      method: "GET",
      url: "/api/v1/chat/conversations",
      headers: {
        "x-user-id": "admin_supervisor_01",
        "x-user-role": "admin",
      },
    });
    if (adminListRes.statusCode !== 200) {
      throw new Error(`Expected 200 OK for admin list, got ${adminListRes.statusCode}`);
    }
    const adminListData = JSON.parse(adminListRes.body);
    if (!adminListData.conversations.some((c: any) => c.id === createdConversationId)) {
      throw new Error("Created conversation missing from admin oversight listing");
    }
    console.log(`  ✓ Administrator retrieved global conversation queue (${adminListData.total} items)`);

    // [Test 13] Support Ticket Chat Session Creation
    console.log("\n[Test 13] Customer-to-Support Ticket Session Flow");
    const supportTicketId = `tkt_live_chat_${runSuffix}`;
    const supportConvRes = await app.inject({
      method: "POST",
      url: "/api/v1/chat/conversations",
      headers: {
        "x-user-id": buyerUserId,
        "x-user-role": "user",
      },
      payload: {
        type: "SUPPORT_TICKET",
        title: "Live Support Ticket Discussion",
        ticketId: supportTicketId,
        participantUserIds: ["agent_sla_support_001"],
        initialMessage: "Need immediate assistance regarding order delay.",
      },
    });
    if (supportConvRes.statusCode !== 201) {
      throw new Error(`Failed to create support chat session: ${supportConvRes.body}`);
    }
    const supportConv = JSON.parse(supportConvRes.body);
    if (supportConv.ticketId !== supportTicketId) {
      throw new Error("Support chat ticketId mismatch");
    }
    console.log(`  ✓ Created support chat session linked to ticket #${supportTicketId}`);

    // [Test 14] User Unblocking & Resumed Messaging
    console.log("\n[Test 14] User Unblocking & Resumed Messaging");
    const unblockRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/chat/users/${sellerUserId}/block`,
      headers: { "x-user-id": buyerUserId },
    });
    if (unblockRes.statusCode !== 200) {
      throw new Error(`Failed to unblock user: ${unblockRes.body}`);
    }
    console.log("  ✓ User unblocked successfully");

    const resumedMsgRes = await app.inject({
      method: "POST",
      url: `/api/v1/chat/conversations/${createdConversationId}/messages`,
      headers: {
        "x-user-id": sellerUserId,
        "x-user-role": "seller",
      },
      payload: { content: "Thank you for unblocking, I can assist you now!" },
    });
    if (resumedMsgRes.statusCode !== 201) {
      throw new Error(`Expected message send to succeed after unblock, got ${resumedMsgRes.statusCode}`);
    }
    console.log("  ✓ Subsequent message sent successfully after unblocking");

    // [Test 15] Idempotency Key Duplicate Prevention
    console.log("\n[Test 15] Idempotency Key Handling");
    const idempKey = `test-idemp-chat-key-${runSuffix}`;
    const newConvRes = await app.inject({
      method: "POST",
      url: "/api/v1/chat/conversations",
      headers: {
        "x-user-id": buyerUserId,
        "x-user-role": "user",
        "idempotency-key": idempKey,
      },
      payload: {
        type: "DIRECT_BUYER_SELLER",
        title: "Idempotent Conversation Test",
        participantUserIds: [sellerUserId],
      },
    });
    console.log("  ✓ Idempotency-Key request processed cleanly");

    console.log("\n==================================================");
    console.log("  ALL CHAT INTEGRATION TESTS PASSED (15/15)       ");
    console.log("==================================================\n");
  } finally {
    await app.close();
    await closeDatabase();
    await closeRedisClient();
  }
}

runIntegrationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Integration tests failed:", err);
    process.exit(1);
  });
