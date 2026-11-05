import "reflect-metadata";
import assert from "node:assert/strict";
import {
  CreateTicketSchema,
  AddTicketMessageSchema,
  AssignTicketSchema,
  EscalateTicketSchema,
  UpdateTicketSchema,
  TicketFilterSchema,
} from "@repo/types";

function runSchemaUnitTests() {
  console.log("==================================================");
  console.log("   SUPPORT SERVICE - SCHEMAS & VALIDATION TESTS   ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  function isZodError(err: any): boolean {
    return Boolean(
      err &&
        (err.name === "ZodError" ||
          Array.isArray(err.issues) ||
          Array.isArray(err.errors)),
    );
  }

  console.log("[1. CreateTicketSchema Validations]");

  test("Valid ticket creation payload parses and applies defaults", () => {
    const input = {
      subject: "Order shipment delayed",
      description: "My order #12345 has not moved in 5 days.",
      categoryCode: "SHIPPING_DELAY",
    };
    const parsed = CreateTicketSchema.parse(input);
    assert.equal(parsed.subject, input.subject);
    assert.equal(parsed.description, input.description);
    assert.equal(parsed.categoryCode, input.categoryCode);
    assert.equal(parsed.priority, "MEDIUM");
    assert.equal(parsed.source, "CUSTOMER");
  });

  test("Ticket creation accepts entity links (orderId, returnId, paymentId, sellerId)", () => {
    const input = {
      subject: "Defective item in return request",
      description: "Item zipper broken upon arrival.",
      categoryCode: "RETURN_REFUND",
      orderId: "ord_test_001",
      returnId: "ret_test_001",
      paymentId: "pay_test_001",
      sellerId: "seller_test_001",
      priority: "HIGH" as const,
    };
    const parsed = CreateTicketSchema.parse(input);
    assert.equal(parsed.orderId, "ord_test_001");
    assert.equal(parsed.returnId, "ret_test_001");
    assert.equal(parsed.paymentId, "pay_test_001");
    assert.equal(parsed.sellerId, "seller_test_001");
    assert.equal(parsed.priority, "HIGH");
  });

  test("Subject shorter than 3 characters is rejected", () => {
    assert.throws(
      () =>
        CreateTicketSchema.parse({
          subject: "Hi",
          description: "Valid long description text",
          categoryCode: "GENERAL",
        }),
      (err) => isZodError(err),
    );
  });

  test("Description shorter than 10 characters is rejected", () => {
    assert.throws(
      () =>
        CreateTicketSchema.parse({
          subject: "Valid subject",
          description: "too short",
          categoryCode: "GENERAL",
        }),
      (err) => isZodError(err),
    );
  });

  test("Missing categoryCode is rejected", () => {
    assert.throws(
      () =>
        CreateTicketSchema.parse({
          subject: "Valid subject",
          description: "Valid long description text",
        }),
      (err) => isZodError(err),
    );
  });

  console.log("\n[2. AddTicketMessageSchema Validations]");

  test("Valid message parses with isInternalNote defaulting to false", () => {
    const input = {
      content: "Here is the tracking number as requested: TRK-9999",
    };
    const parsed = AddTicketMessageSchema.parse(input);
    assert.equal(parsed.content, input.content);
    assert.equal(parsed.isInternalNote, false);
    assert.deepEqual(parsed.attachments, []);
  });

  test("Internal note flag is preserved when true", () => {
    const input = {
      content: "Investigating fraudulent address via carrier tracking API.",
      isInternalNote: true,
      attachments: [
        {
          name: "fraud_report.pdf",
          url: "https://storage.larekmart.com/fraud.pdf",
          mimeType: "application/pdf",
        },
      ],
    };
    const parsed = AddTicketMessageSchema.parse(input);
    assert.equal(parsed.isInternalNote, true);
    assert.equal(parsed.attachments.length, 1);
  });

  test("Empty message content is rejected", () => {
    assert.throws(
      () => AddTicketMessageSchema.parse({ content: "" }),
      (err) => isZodError(err),
    );
  });

  console.log("\n[3. AssignTicketSchema Validations]");

  test("Valid assignment payload parses", () => {
    const input = {
      assignedTo: "agent_support_42",
      assignedTeam: "TIER_2" as const,
      notes: "Escalated due to customer VIP tier",
    };
    const parsed = AssignTicketSchema.parse(input);
    assert.equal(parsed.assignedTo, "agent_support_42");
    assert.equal(parsed.assignedTeam, "TIER_2");
    assert.equal(parsed.notes, "Escalated due to customer VIP tier");
  });

  test("Assignment without assignedTo is rejected", () => {
    assert.throws(
      () => AssignTicketSchema.parse({ notes: "missing assignedTo" }),
      (err) => isZodError(err),
    );
  });

  console.log("\n[4. EscalateTicketSchema Validations]");

  test("Valid escalation payload parses with defaults", () => {
    const input = {
      escalationReason:
        "Customer threatened legal action due to delayed high-value shipment",
    };
    const parsed = EscalateTicketSchema.parse(input);
    assert.equal(parsed.escalationReason, input.escalationReason);
    assert.equal(parsed.targetTeam, "ESCALATIONS");
  });

  test("Escalation without escalationReason is rejected", () => {
    assert.throws(
      () => EscalateTicketSchema.parse({ priority: "CRITICAL" }),
      (err) => isZodError(err),
    );
  });

  test("Escalation reason shorter than 5 characters is rejected", () => {
    assert.throws(
      () => EscalateTicketSchema.parse({ escalationReason: "bad" }),
      (err) => isZodError(err),
    );
  });

  console.log("\n[5. UpdateTicketSchema Validations]");

  test("Valid status update parses", () => {
    const parsed = UpdateTicketSchema.parse({ status: "RESOLVED" });
    assert.equal(parsed.status, "RESOLVED");
  });

  test("Invalid status transition value is rejected", () => {
    assert.throws(
      () => UpdateTicketSchema.parse({ status: "INVALID_STATUS" }),
      (err) => isZodError(err),
    );
  });

  console.log("\n[6. TicketFilterSchema Validations]");

  test("Filter schema coerces pagination parameters", () => {
    const parsed = TicketFilterSchema.parse({
      limit: "15",
      offset: "30",
      status: "OPEN",
      isEscalated: "true",
    });
    assert.equal(parsed.limit, 15);
    assert.equal(parsed.offset, 30);
    assert.equal(parsed.status, "OPEN");
    assert.equal(parsed.isEscalated, true);
  });

  test("Filter schema defaults limit to 20 and offset to 0", () => {
    const parsed = TicketFilterSchema.parse({});
    assert.equal(parsed.limit, 20);
    assert.equal(parsed.offset, 0);
  });

  console.log("\n==================================================");
  console.log(
    `  SCHEMAS & VALIDATION TESTS: ${passed} passed, ${failed} failed`,
  );
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSchemaUnitTests();
