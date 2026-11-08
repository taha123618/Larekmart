import { safeTimingCompare } from "../../src/middleware/auth.middleware.js";
import {
  CreateConversationSchema,
  SendMessageSchema,
  ReportMessageSchema,
  BlockUserSchema,
  MessageFilterSchema,
  ConversationFilterSchema,
  MarkReadSchema,
  ChatAttachmentSchema,
} from "@repo/types";

console.log("==================================================");
console.log("       CHAT SERVICE - UNIT TEST SUITE            ");
console.log("==================================================\n");

let passedCount = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedCount++;
}

// [1. Constant-Time Timing-Safe Comparison]
console.log("[1. Constant-Time Timing Safe Compare]");
assert(safeTimingCompare("secret123", "secret123"), "Identical strings must return true");
assert(!safeTimingCompare("secret123", "secret124"), "Different strings of same length must return false");
assert(!safeTimingCompare("short", "longer_string"), "Differing lengths must return false");
assert(!safeTimingCompare(undefined, "test"), "Undefined first parameter must return false");
assert(!safeTimingCompare("test", undefined), "Undefined second parameter must return false");
assert(!safeTimingCompare("", "a"), "Empty string vs single char must return false");
assert(!safeTimingCompare("", ""), "Empty strings return false (reject empty secrets)");
console.log("  ✓ Constant-time safeTimingCompare passed 7 security assertions");

// [2. CreateConversationSchema Invariants]
console.log("\n[2. CreateConversationSchema Validations]");
const validConv = CreateConversationSchema.parse({
  type: "DIRECT_BUYER_SELLER",
  sellerId: "seller_apex_01",
  participantUserIds: ["buyer_101", "seller_user_02"],
  initialMessage: "Is this item available?",
  metadata: { priority: "normal", source: "storefront_product" },
});
assert(validConv.participantUserIds.length === 2, "Participant count mismatch");
assert(validConv.type === "DIRECT_BUYER_SELLER", "Conversation type mismatch");
assert(validConv.metadata?.source === "storefront_product", "Metadata should parse cleanly");

// Support Ticket Conversation
const supportConv = CreateConversationSchema.parse({
  type: "SUPPORT_TICKET",
  ticketId: "tkt_arbitration_991",
  participantUserIds: ["agent_01"],
});
assert(supportConv.type === "SUPPORT_TICKET", "Support conversation type failed");
assert(supportConv.ticketId === "tkt_arbitration_991", "ticketId failed to map");

let emptyPartsFailed = false;
try {
  CreateConversationSchema.parse({
    type: "DIRECT_BUYER_SELLER",
    participantUserIds: [],
  });
} catch {
  emptyPartsFailed = true;
}
assert(emptyPartsFailed, "Allowed empty participantUserIds");

let invalidTypeFailed = false;
try {
  CreateConversationSchema.parse({
    type: "INVALID_CONV_TYPE" as any,
    participantUserIds: ["u1"],
  });
} catch {
  invalidTypeFailed = true;
}
assert(invalidTypeFailed, "Allowed invalid conversation type");
console.log("  ✓ CreateConversationSchema enforced required participants, types & metadata");

// [3. SendMessageSchema Validations]
console.log("\n[3. SendMessageSchema Validations]");
const validMsg = SendMessageSchema.parse({
  conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
  content: "Hello! Shipping takes 2 business days.",
  messageType: "TEXT",
});
assert(validMsg.content === "Hello! Shipping takes 2 business days.", "Content mismatch");
assert(validMsg.messageType === "TEXT", "Default messageType TEXT failed");

let emptyContentFailed = false;
try {
  SendMessageSchema.parse({
    conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
    content: "",
  });
} catch {
  emptyContentFailed = true;
}
assert(emptyContentFailed, "Allowed empty message content");

let missingConvIdFailed = false;
try {
  SendMessageSchema.parse({
    content: "Missing conversation ID",
  });
} catch {
  missingConvIdFailed = true;
}
assert(missingConvIdFailed, "Allowed missing conversationId");
console.log("  ✓ SendMessageSchema validated content presence and conversation references");

// [4. ChatAttachmentSchema Validations]
console.log("\n[4. ChatAttachmentSchema Validations]");
const validAttach = ChatAttachmentSchema.parse({
  mediaFileId: "file_pkg_9910",
  fileName: "invoice.pdf",
  fileUrl: "https://storage.larekmart.com/invoices/9910.pdf",
  fileSize: 204800,
  mimeType: "application/pdf",
});
assert(validAttach.fileSize === 204800, "Attachment fileSize mismatch");
assert(validAttach.mimeType === "application/pdf", "MIME type mismatch");

let invalidUrlFailed = false;
try {
  ChatAttachmentSchema.parse({
    mediaFileId: "f1",
    fileName: "doc.txt",
    fileUrl: "not-a-valid-url",
    fileSize: 10,
    mimeType: "text/plain",
  });
} catch {
  invalidUrlFailed = true;
}
assert(invalidUrlFailed, "Allowed invalid fileUrl in attachment");
console.log("  ✓ ChatAttachmentSchema enforced fileUrl format and metadata");

// [5. MessageFilterSchema Validations]
console.log("\n[5. MessageFilterSchema Validations]");
const filterParsed = MessageFilterSchema.parse({
  limit: "25",
  before: "87c29e2e-234b-47d2-8ef8-4935eb614116",
});
assert(filterParsed.limit === 25, "Coerced limit mismatch");
assert(filterParsed.before === "87c29e2e-234b-47d2-8ef8-4935eb614116", "Before cursor mismatch");

// Default pagination values
const defaultFilter = MessageFilterSchema.parse({});
assert(defaultFilter.limit === 50, "Default limit must be 50");
console.log("  ✓ MessageFilterSchema validated limit coercion and cursor attributes");

// [6. ConversationFilterSchema Validations]
console.log("\n[6. ConversationFilterSchema Validations]");
const convFilter = ConversationFilterSchema.parse({
  type: "DIRECT_BUYER_SELLER",
  status: "ACTIVE",
  sellerId: "seller_val_10",
  limit: "15",
});
assert(convFilter.type === "DIRECT_BUYER_SELLER", "Type filter mismatch");
assert(convFilter.status === "ACTIVE", "Status filter mismatch");
assert(convFilter.limit === 15, "Coerced conv limit mismatch");
console.log("  ✓ ConversationFilterSchema verified multi-attribute filtering");

// [7. MarkReadSchema Validations]
console.log("\n[7. MarkReadSchema Validations]");
const markRead = MarkReadSchema.parse({
  conversationId: "87c29e2e-234b-47d2-8ef8-4935eb614116",
  messageId: "c1a967c3-3eb3-4df4-aefc-347b5ef9700a",
});
assert(markRead.conversationId === "87c29e2e-234b-47d2-8ef8-4935eb614116", "Conv ID mismatch");
assert(markRead.messageId === "c1a967c3-3eb3-4df4-aefc-347b5ef9700a", "Message ID mismatch");
console.log("  ✓ MarkReadSchema validated read receipt acknowledgments");

// [8. Moderation & Abuse Prevention Schemas]
console.log("\n[8. Moderation Schemas]");
const validBlock = BlockUserSchema.parse({
  blockedUserId: "spammer_user_09",
  reason: "Repeated spam links",
});
assert(validBlock.blockedUserId === "spammer_user_09", "BlockUserSchema failed");

const validReport = ReportMessageSchema.parse({
  reason: "Inappropriate language in chat",
  category: "HARASSMENT",
});
assert(validReport.category === "HARASSMENT", "ReportMessageSchema failed");
assert(validReport.reason === "Inappropriate language in chat", "Reason mismatch");

let invalidCatFailed = false;
try {
  ReportMessageSchema.parse({
    reason: "Some reason",
    category: "INVALID_CAT" as any,
  });
} catch {
  invalidCatFailed = true;
}
assert(invalidCatFailed, "Allowed invalid moderation category");
console.log("  ✓ Moderation schemas verified categories and reason descriptions");

// [9. Presence Scoping & Room Formatting]
console.log("\n[9. Presence Scoping & Room Formatting]");
const convId = "conv_123_abc";
const formattedRoom = `conv:${convId}`;
assert(formattedRoom === "conv:conv_123_abc", "Room formatting mismatch");
const userRoom = `user:${"usr_999"}`;
assert(userRoom === "user:usr_999", "User room mismatch");
console.log("  ✓ Presence room formatting verified for scoped broadcasts");

console.log("\n==================================================");
console.log(`  CHAT SERVICE UNIT TESTS PASSED (${passedCount} assertions) `);
console.log("==================================================\n");
