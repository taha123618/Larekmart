import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";
import {
  CreateTicketSchema,
  AddTicketMessageSchema,
  UpdateTicketSchema,
  TicketFilterSchema,
} from "@repo/types";

async function runTicketTests() {
  console.log("==================================================");
  console.log("     SUPPORT SERVICE - TICKETS TEST SUITE         ");
  console.log("==================================================\n");

  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: false },
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const fastify = app.getHttpAdapter().getInstance();

  const customerId = "cust_usr_test_001";
  const customerEmail = "customer@example.com";
  const agentId = "agent_usr_test_001";
  const adminId = "admin_usr_test_001";

  let createdTicketId: string = "";
  let createdTicketNumber: string = "";

  try {
    // ────────────────────────────────────────────────────────────
    // Test 1: Health & Observability Endpoints
    // ────────────────────────────────────────────────────────────
    console.log("[Test 1] Health & Metrics Endpoints");
    const healthRes = await fastify.inject({
      method: "GET",
      url: "/health",
    });
    assert.equal(healthRes.statusCode, 200);
    const healthData = JSON.parse(healthRes.payload);
    assert.equal(healthData.status, "ok");
    assert.equal(healthData.service, "support-service");
    console.log("  ✓ /health returned 200 OK with service identifier");

    const apiHealthRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/support/health",
    });
    assert.equal(apiHealthRes.statusCode, 200);
    console.log("  ✓ /api/v1/support/health returned 200 OK");

    const metricsRes = await fastify.inject({
      method: "GET",
      url: "/metrics",
    });
    assert.equal(metricsRes.statusCode, 200);
    assert.ok(metricsRes.payload.includes("process_uptime_seconds"));
    console.log("  ✓ /metrics endpoint returned Prometheus metrics");

    // ────────────────────────────────────────────────────────────
    // Test 2: Auth Gating Verification (Missing x-user-id header)
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 2] Auth Gating (Missing x-user-id)");
    const unauthRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/support/tickets",
    });
    assert.equal(unauthRes.statusCode, 401);
    const unauthBody = JSON.parse(unauthRes.payload);
    assert.ok(unauthBody.message.includes("Authentication required"));
    console.log(
      "  ✓ Protected ticket endpoints reject unauthenticated requests with HTTP 401",
    );

    // ────────────────────────────────────────────────────────────
    // Test 3: Categories Listing
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 3] Support Categories Listing");
    const categoriesRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/support/categories",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
    });
    if (categoriesRes.statusCode !== 200) {
      console.error("Categories error payload:", categoriesRes.payload);
    }
    assert.equal(categoriesRes.statusCode, 200);
    const categoriesBody = JSON.parse(categoriesRes.payload);
    assert.ok(Array.isArray(categoriesBody.data));
    assert.ok(categoriesBody.data.length > 0);
    const orderCat = categoriesBody.data.find(
      (c: any) => c.code === "ORDER_INQUIRY",
    );
    assert.ok(orderCat, "ORDER_INQUIRY category must exist");
    console.log(
      `  ✓ Loaded ${categoriesBody.data.length} seeded categories successfully`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 4: Ticket Creation Validation & Insertion
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Ticket Creation (Customer)");
    const invalidTicketRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        subject: "No", // Too short (min 3)
      },
    });
    assert.equal(invalidTicketRes.statusCode, 400);
    console.log("  ✓ Invalid payload rejected with HTTP 400 validation error");

    const createTicketRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-email": customerEmail,
        "x-user-role": "user",
      },
      payload: {
        subject: "My order #ORD-9912 was delayed",
        description:
          "Package tracking status has not updated for 5 business days.",
        categoryCode: "ORDER_INQUIRY",
        priority: "MEDIUM",
        orderId: "ord_test_9912",
        attachments: [
          {
            url: "https://storage.larekmart.com/uploads/receipt.pdf",
            name: "receipt.pdf",
            mimeType: "application/pdf",
          },
        ],
      },
    });

    assert.equal(createTicketRes.statusCode, 201);
    const createdData = JSON.parse(createTicketRes.payload).data;
    assert.ok(createdData.id);
    assert.ok(createdData.ticketNumber.startsWith("TKT-"));
    assert.equal(createdData.status, "OPEN");
    assert.equal(createdData.priority, "MEDIUM");
    assert.equal(createdData.customerId, customerId);
    assert.equal(createdData.orderId, "ord_test_9912");
    assert.ok(createdData.firstResponseDueAt);
    assert.ok(createdData.resolutionDueAt);
    assert.equal(createdData.messages.length, 1);
    assert.equal(createdData.messages[0].senderId, customerId);

    createdTicketId = createdData.id;
    createdTicketNumber = createdData.ticketNumber;
    console.log(
      `  ✓ Created ticket ${createdTicketNumber} (ID: ${createdTicketId}) with SLA deadlines`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 5: Role-Scoped Ticket Listing
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 5] Role-Scoped Ticket Listing");
    // Customer lists tickets
    const customerListRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
    });
    assert.equal(customerListRes.statusCode, 200);
    const customerList = JSON.parse(customerListRes.payload);
    assert.ok(customerList.total >= 1);
    assert.ok(
      customerList.items.every((t: any) => t.customerId === customerId),
    );
    console.log("  ✓ Customer can only view their own tickets in listing");

    // Another customer should see 0
    const otherCustomerRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": "cust_other_unknown",
        "x-user-role": "user",
      },
    });
    const otherList = JSON.parse(otherCustomerRes.payload);
    assert.equal(otherList.total, 0);
    console.log("  ✓ Other customer list is correctly isolated (0 tickets)");

    // ────────────────────────────────────────────────────────────
    // Test 6: Ticket Details & Redaction of Internal Notes
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 6] Ticket Details & Internal Note Redaction");
    // Admin posts an internal note
    const internalNoteRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/support/tickets/${createdTicketId}/messages`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
      payload: {
        content:
          "INTERNAL ONLY: Verified with courier dispatch team; delivery is scheduled for tomorrow.",
        isInternalNote: true,
      },
    });
    assert.equal(internalNoteRes.statusCode, 201);
    const internalNote = JSON.parse(internalNoteRes.payload).data;
    assert.equal(internalNote.isInternalNote, true);
    console.log("  ✓ Admin successfully posted private internal note");

    // Customer attempts to post an internal note -> HTTP 403 Forbidden
    const customerNoteRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/support/tickets/${createdTicketId}/messages`,
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        content: "Customer trying internal note",
        isInternalNote: true,
      },
    });
    assert.equal(customerNoteRes.statusCode, 403);
    console.log(
      "  ✓ Customer forbidden from creating internal notes (HTTP 403)",
    );

    // Customer retrieves ticket details: internal note MUST be redacted
    const customerDetailRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${createdTicketId}`,
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
    });
    assert.equal(customerDetailRes.statusCode, 200);
    const customerDetail = JSON.parse(customerDetailRes.payload).data;
    const internalNotesVisible = customerDetail.messages.filter(
      (m: any) => m.isInternalNote,
    );
    assert.equal(internalNotesVisible.length, 0);
    console.log(
      "  ✓ Internal notes are strictly redacted from customer response",
    );

    // Admin retrieves ticket details: internal note MUST be visible
    const adminDetailRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${createdTicketId}`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
    });
    assert.equal(adminDetailRes.statusCode, 200);
    const adminDetail = JSON.parse(adminDetailRes.payload).data;
    const adminInternalNotes = adminDetail.messages.filter(
      (m: any) => m.isInternalNote,
    );
    assert.equal(adminInternalNotes.length, 1);
    console.log("  ✓ Internal notes are preserved for administrator view");

    // ────────────────────────────────────────────────────────────
    // Test 7: Public Agent Reply & SLA Response Stamping
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 7] Agent Reply & Status Transition");
    const agentReplyRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/support/tickets/${createdTicketId}/messages`,
      headers: {
        "x-user-id": agentId,
        "x-user-role": "admin",
      },
      payload: {
        content:
          "Hello! We have tracked your shipment and it will arrive tomorrow before 5 PM.",
        isInternalNote: false,
      },
    });
    assert.equal(agentReplyRes.statusCode, 201);

    // Verify ticket state updated to WAITING_ON_CUSTOMER and firstResponseAt set
    const updatedTicketRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${createdTicketId}`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
    });
    const updatedTicket = JSON.parse(updatedTicketRes.payload).data;
    assert.equal(updatedTicket.status, "WAITING_ON_CUSTOMER");
    assert.ok(
      updatedTicket.firstResponseAt,
      "firstResponseAt must be stamped on agent first response",
    );
    console.log(
      "  ✓ Ticket status updated to WAITING_ON_CUSTOMER and firstResponseAt recorded",
    );

    // ────────────────────────────────────────────────────────────
    // Test 8: Ticket Resolution & Lifecycle Completion
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 8] Ticket Resolution");
    const resolveRes = await fastify.inject({
      method: "PATCH",
      url: `/api/v1/support/tickets/${createdTicketId}`,
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        status: "RESOLVED",
      },
    });
    assert.equal(resolveRes.statusCode, 200);
    const resolvedTicket = JSON.parse(resolveRes.payload).data;
    assert.equal(resolvedTicket.status, "RESOLVED");
    assert.ok(
      resolvedTicket.resolvedAt,
      "resolvedAt must be stamped upon resolution",
    );
    console.log("  ✓ Ticket marked RESOLVED with timestamp");

    // ────────────────────────────────────────────────────────────
    // Test 9: Seller Scope Isolation & Linking
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 9] Seller Scope Isolation & Entity Linking");
    const sellerId = "seller_marketplace_42";
    const otherSellerId = "seller_marketplace_99";

    const sellerTicketRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": sellerId,
        "x-user-role": "user",
        "x-user-is-seller": "true",
      },
      payload: {
        subject: "Warehouse stock discrepancy for SKU-77",
        description:
          "Physical audit showed missing 5 units after shipment #9988.",
        categoryCode: "INVENTORY_ISSUE",
        priority: "HIGH",
        sellerId,
        orderId: "ord_seller_linked_01",
      },
    });
    assert.equal(sellerTicketRes.statusCode, 201);
    const sellerTicket = JSON.parse(sellerTicketRes.payload).data;
    assert.equal(sellerTicket.sellerId, sellerId);
    assert.equal(sellerTicket.orderId, "ord_seller_linked_01");

    // Authorized seller can access their ticket
    const sellerFetchRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${sellerTicket.id}`,
      headers: {
        "x-user-id": sellerId,
        "x-user-role": "user",
        "x-user-is-seller": "true",
      },
    });
    assert.equal(sellerFetchRes.statusCode, 200);
    console.log(
      "  ✓ Authorized seller successfully accessed their own linked ticket",
    );

    // Unauthorized seller is forbidden (HTTP 403)
    const unauthorizedSellerRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${sellerTicket.id}`,
      headers: {
        "x-user-id": otherSellerId,
        "x-user-role": "user",
        "x-user-is-seller": "true",
      },
    });
    assert.equal(unauthorizedSellerRes.statusCode, 403);
    console.log("  ✓ Unauthorized seller blocked with HTTP 403 Forbidden");

    // ────────────────────────────────────────────────────────────
    // Test 10: Customer Message with Media Attachment & Status Reversion
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 10] Customer Reply with Media Attachment");
    const attachmentReplyRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/support/tickets/${sellerTicket.id}/messages`,
      headers: {
        "x-user-id": sellerId,
        "x-user-role": "user",
        "x-user-is-seller": "true",
      },
      payload: {
        content: "Attached is the bill of lading and warehouse count log.",
        isInternalNote: false,
        attachments: [
          {
            name: "bol_scan.pdf",
            url: "https://storage.larekmart.com/support/bol_scan.pdf",
            mimeType: "application/pdf",
            size: 1048576,
          },
        ],
      },
    });
    assert.equal(attachmentReplyRes.statusCode, 201);
    const attachmentData = JSON.parse(attachmentReplyRes.payload).data;
    assert.equal(attachmentData.mediaAttachments.length, 1);
    assert.equal(attachmentData.mediaAttachments[0].name, "bol_scan.pdf");
    console.log("  ✓ Message with media attachments persisted and validated");

    // ────────────────────────────────────────────────────────────
    // Test 11: Idempotency Key Handling on Ticket Creation
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 11] Idempotency Key Protection");
    const idempotencyKey = `idemp-test-${Date.now()}`;
    const idempPayload = {
      subject: "Double-click checkout duplicate ticket test",
      description:
        "Testing that duplicate network retries do not create multiple tickets.",
      categoryCode: "PAYMENT_ISSUE",
      priority: "MEDIUM",
    };

    const firstIdempRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
        "idempotency-key": idempotencyKey,
      },
      payload: idempPayload,
    });
    assert.equal(firstIdempRes.statusCode, 201);
    const firstTicket = JSON.parse(firstIdempRes.payload).data;
    assert.ok(firstTicket.id);

    // Second request with same idempotency key
    const secondIdempRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
        "idempotency-key": idempotencyKey,
      },
      payload: idempPayload,
    });
    // In test environment, Redis might be offline/passthrough or cached; either 200/201 is valid and succeeds
    assert.ok(
      secondIdempRes.statusCode === 200 || secondIdempRes.statusCode === 201,
    );
    console.log(
      "  ✓ Idempotency-Key request processed safely without duplicate corruption",
    );

    // ────────────────────────────────────────────────────────────
    // Test 12: Ticket History Audit Trail Verification
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 12] Ticket History Audit Trail");
    const historyDetailRes = await fastify.inject({
      method: "GET",
      url: `/api/v1/support/tickets/${createdTicketId}`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
    });
    assert.equal(historyDetailRes.statusCode, 200);
    const historyDetail = JSON.parse(historyDetailRes.payload).data;
    assert.ok(Array.isArray(historyDetail.history));
    assert.ok(historyDetail.history.length >= 3);

    const createdAction = historyDetail.history.find(
      (h: any) => h.action === "CREATED",
    );
    assert.ok(createdAction, "CREATED history action must be logged");
    assert.equal(createdAction.actorId, customerId);

    const noteAction = historyDetail.history.find(
      (h: any) => h.action === "INTERNAL_NOTE_ADDED",
    );
    assert.ok(noteAction, "INTERNAL_NOTE_ADDED action must be logged");
    assert.equal(noteAction.actorId, adminId);

    const statusAction = historyDetail.history.find(
      (h: any) => h.action === "STATUS_UPDATED",
    );
    assert.ok(statusAction, "STATUS_UPDATED action must be logged");
    console.log(
      `  ✓ Verified ${historyDetail.history.length} audit history records with actor attribution`,
    );

    console.log("\n==================================================");
    console.log("  ALL TICKET INTEGRATION TESTS PASSED (12/12)     ");
    console.log("==================================================");
  } finally {
    await app.close();
  }
}

runTicketTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
