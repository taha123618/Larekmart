import assert from "node:assert/strict";
import {
  TicketPriorityEnum,
  TicketStatusEnum,
  TicketSourceEnum,
  SenderRoleEnum,
  SupportTeamEnum,
  CreateTicketSchema,
  UpdateTicketSchema,
  AddTicketMessageSchema,
  AssignTicketSchema,
  EscalateTicketSchema,
  TicketFilterSchema,
  SUPPORT_TOPICS,
} from "../src/support.js";

console.log("=== Support Domain Contracts & Zod Schemas Test Suite ===");

// 1. Enums
console.log("\n[Test 1] Ticket Enums & Schemas");
assert.equal(TicketPriorityEnum.parse("LOW"), "LOW");
assert.equal(TicketPriorityEnum.parse("CRITICAL"), "CRITICAL");
assert.equal(TicketPriorityEnum.parse("URGENT"), "URGENT");
assert.throws(() => TicketPriorityEnum.parse("NON_EXISTENT"));

assert.equal(TicketStatusEnum.parse("OPEN"), "OPEN");
assert.equal(TicketStatusEnum.parse("IN_PROGRESS"), "IN_PROGRESS");
assert.equal(
  TicketStatusEnum.parse("WAITING_ON_CUSTOMER"),
  "WAITING_ON_CUSTOMER",
);
assert.equal(TicketStatusEnum.parse("RESOLVED"), "RESOLVED");
assert.equal(TicketStatusEnum.parse("CLOSED"), "CLOSED");
assert.throws(() => TicketStatusEnum.parse("UNKNOWN_STATUS"));

assert.equal(TicketSourceEnum.parse("CUSTOMER"), "CUSTOMER");
assert.equal(TicketSourceEnum.parse("SELLER"), "SELLER");
assert.equal(TicketSourceEnum.parse("ADMIN"), "ADMIN");

assert.equal(SenderRoleEnum.parse("CUSTOMER"), "CUSTOMER");
assert.equal(SenderRoleEnum.parse("SELLER"), "SELLER");
assert.equal(SenderRoleEnum.parse("AGENT"), "AGENT");
assert.equal(SenderRoleEnum.parse("ADMIN"), "ADMIN");

assert.equal(SupportTeamEnum.parse("TIER_1"), "TIER_1");
assert.equal(SupportTeamEnum.parse("ESCALATIONS"), "ESCALATIONS");
console.log("  ✓ All Ticket enums verified successfully");

// 2. CreateTicketSchema
console.log("\n[Test 2] CreateTicketSchema Invariants");
const validTicket = CreateTicketSchema.parse({
  categoryCode: "ORDER_ISSUES",
  subject: "Damaged packaging on arrival",
  description: "The parcel was delivered in wet and torn box.",
  priority: "HIGH",
  orderId: "ord_12345",
});
assert.equal(validTicket.categoryCode, "ORDER_ISSUES");
assert.equal(validTicket.priority, "HIGH");
assert.equal(validTicket.orderId, "ord_12345");

// Subject too short
assert.throws(() =>
  CreateTicketSchema.parse({
    categoryCode: "ORDER_ISSUES",
    subject: "ab",
    description: "Valid description longer than 10 characters",
  }),
);

// Description too short
assert.throws(() =>
  CreateTicketSchema.parse({
    categoryCode: "ORDER_ISSUES",
    subject: "Valid subject",
    description: "Short",
  }),
);
console.log("  ✓ CreateTicketSchema boundary invariants enforced");

// 3. AddTicketMessageSchema
console.log("\n[Test 3] AddTicketMessageSchema Invariants");
const msg = AddTicketMessageSchema.parse({
  content: "Here are the photos of the package.",
  isInternalNote: false,
  attachments: [
    {
      name: "box.jpg",
      url: "https://media.larekmart.com/box.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    },
  ],
});
assert.equal(msg.isInternalNote, false);
assert.equal(msg.attachments?.length, 1);
assert.throws(() =>
  AddTicketMessageSchema.parse({
    content: "",
  }),
);
console.log("  ✓ AddTicketMessageSchema verified");

// 4. AssignTicketSchema & EscalateTicketSchema
console.log("\n[Test 4] Assignment & Escalation Schemas");
const assignment = AssignTicketSchema.parse({
  assignedTo: "agent_ops_01",
  assignedTeam: "TIER_2",
  notes: "Assigned for immediate review",
});
assert.equal(assignment.assignedTo, "agent_ops_01");

const escalation = EscalateTicketSchema.parse({
  escalationReason: "Customer VIP account with pending high-value delivery",
  priority: "CRITICAL",
  targetTeam: "ESCALATIONS",
});
assert.equal(escalation.priority, "CRITICAL");
assert.throws(() =>
  EscalateTicketSchema.parse({
    escalationReason: "Why", // min 5 chars
  }),
);
console.log("  ✓ Assignment & Escalation schemas verified");

// 5. UpdateTicketSchema
console.log("\n[Test 5] UpdateTicketSchema & Filter Schema");
const update = UpdateTicketSchema.parse({
  status: "RESOLVED",
});
assert.equal(update.status, "RESOLVED");

const filter = TicketFilterSchema.parse({
  status: "OPEN",
  limit: "15",
  offset: "30",
});
assert.equal(filter.limit, 15);
assert.equal(filter.offset, 30);
console.log("  ✓ Update and Filter schemas verified");

// 6. Topics
console.log("\n[Test 6] Support Kafka Topics");
assert.equal(SUPPORT_TOPICS.TICKET_CREATED, "support.ticket.created");
assert.equal(SUPPORT_TOPICS.TICKET_ASSIGNED, "support.ticket.assigned");
assert.equal(SUPPORT_TOPICS.TICKET_UPDATED, "support.ticket.updated");
assert.equal(SUPPORT_TOPICS.TICKET_RESOLVED, "support.ticket.resolved");
console.log("  ✓ Support Kafka topic contracts verified");

console.log("\n=======================================================");
console.log(" All Support Domain Contracts Passed Successfully! 🎉 ");
console.log("=======================================================\n");
