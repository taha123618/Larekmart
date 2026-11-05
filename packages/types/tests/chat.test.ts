import {
  ConversationTypeEnum,
  ConversationStatusEnum,
  ParticipantRoleEnum,
  MessageTypeEnum,
  ReceiptStatusEnum,
  CreateConversationSchema,
  SendMessageSchema,
  MarkReadSchema,
  ReportMessageSchema,
  BlockUserSchema,
  ConversationFilterSchema,
  MessageFilterSchema,
  CHAT_KAFKA_TOPICS,
} from "../src/chat.js";

console.log("=== Chat Domain Contracts & Zod Schemas Test Suite ===\n");

// 1. Enums
console.log("[Test 1] Chat Enums");
if (
  ConversationTypeEnum.parse("DIRECT_BUYER_SELLER") !== "DIRECT_BUYER_SELLER" ||
  ConversationTypeEnum.parse("SUPPORT_TICKET") !== "SUPPORT_TICKET"
) {
  throw new Error("ConversationTypeEnum failed");
}
if (
  ParticipantRoleEnum.parse("BUYER") !== "BUYER" ||
  ParticipantRoleEnum.parse("SELLER") !== "SELLER" ||
  ParticipantRoleEnum.parse("SUPPORT_AGENT") !== "SUPPORT_AGENT"
) {
  throw new Error("ParticipantRoleEnum failed");
}
if (
  MessageTypeEnum.parse("TEXT") !== "TEXT" ||
  MessageTypeEnum.parse("IMAGE") !== "IMAGE" ||
  MessageTypeEnum.parse("PRODUCT_CARD") !== "PRODUCT_CARD"
) {
  throw new Error("MessageTypeEnum failed");
}
console.log("  ✓ All Chat enums verified successfully");

// 2. CreateConversationSchema
console.log("\n[Test 2] CreateConversationSchema Invariants");
const validConv = CreateConversationSchema.parse({
  type: "DIRECT_BUYER_SELLER",
  sellerId: "seller_test_901",
  participantUserIds: ["buyer_01", "seller_user_02"],
  initialMessage: "Hello, is this trail boot available in size 42?",
});
if (validConv.participantUserIds.length !== 2) {
  throw new Error("CreateConversationSchema participant count mismatch");
}

let emptyParticipantsFailed = false;
try {
  CreateConversationSchema.parse({
    type: "DIRECT_BUYER_SELLER",
    participantUserIds: [],
  });
} catch {
  emptyParticipantsFailed = true;
}
if (!emptyParticipantsFailed) {
  throw new Error("CreateConversationSchema allowed empty participants");
}
console.log("  ✓ CreateConversationSchema boundary invariants enforced");

// 3. SendMessageSchema
console.log("\n[Test 3] SendMessageSchema Invariants");
const validMsg = SendMessageSchema.parse({
  conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
  messageType: "TEXT",
  content: "Yes, size 42 is in stock and ready to ship!",
});
if (validMsg.content.length === 0) {
  throw new Error("SendMessageSchema empty content");
}

let emptyContentFailed = false;
try {
  SendMessageSchema.parse({
    conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
    content: "",
  });
} catch {
  emptyContentFailed = true;
}
if (!emptyContentFailed) {
  throw new Error("SendMessageSchema allowed empty message content");
}
console.log("  ✓ SendMessageSchema verified");

// 4. Moderation & Receipts
console.log("\n[Test 4] Moderation & Receipts Schemas");
const validReport = ReportMessageSchema.parse({
  reason: "User is sending unsolicited marketing links",
  category: "SPAM",
});
if (validReport.category !== "SPAM") {
  throw new Error("ReportMessageSchema failed");
}

const validBlock = BlockUserSchema.parse({
  blockedUserId: "malicious_user_404",
  reason: "Repeated spam inquiries",
});
if (validBlock.blockedUserId !== "malicious_user_404") {
  throw new Error("BlockUserSchema failed");
}

const validReceipt = MarkReadSchema.parse({
  conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
});
if (!validReceipt.conversationId) {
  throw new Error("MarkReadSchema failed");
}
console.log("  ✓ Moderation and Read Receipt schemas verified");

// 5. Kafka Topics
console.log("\n[Test 5] Chat Kafka Topics");
if (
  CHAT_KAFKA_TOPICS.MESSAGE_CREATED !== "chat.message.created" ||
  CHAT_KAFKA_TOPICS.MESSAGE_REPORTED !== "chat.message.reported" ||
  CHAT_KAFKA_TOPICS.CONVERSATION_CREATED !== "chat.conversation.created"
) {
  throw new Error("Chat Kafka topic constants invalid");
}
console.log("  ✓ Chat Kafka topic contracts verified");

console.log("\n=======================================================");
console.log(" All Chat Domain Contracts Passed Successfully! 🎉 ");
console.log("=======================================================\n");
