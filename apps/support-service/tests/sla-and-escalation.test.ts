import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";

async function runSlaAndEscalationTests() {
  console.log("==================================================");
  console.log("  SUPPORT SERVICE - SLA & ESCALATION TEST SUITE   ");
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

  const customerId = "cust_sla_test_001";
  const agentId = "agent_sla_test_001";
  const adminId = "admin_sla_test_001";

  try {
    // ────────────────────────────────────────────────────────────
    // Step 1: Create a ticket to be assigned and escalated
    // ────────────────────────────────────────────────────────────
    console.log("[Step 1] Create Test Ticket");
    const createRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        subject: "Urgent: Marketplace Seller Payout Discrepancy",
        description:
          "Seller balance ledger indicates incorrect commission deduction for order ORD-1002.",
        categoryCode: "SELLER_DISPUTE",
        priority: "HIGH",
        sellerId: "seller_test_901",
      },
    });

    assert.equal(createRes.statusCode, 201);
    const ticket = JSON.parse(createRes.payload).data;
    const ticketId = ticket.id;
    console.log(
      `  ✓ Created test ticket ${ticket.ticketNumber} (ID: ${ticketId})`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 1: Non-Admin Forbidden from Assignment
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 1] Assignment Security Guard");
    const forbiddenAssignRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${ticketId}/assign`,
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        assignedTo: agentId,
        assignedTeam: "SELLER_OPS",
      },
    });
    assert.equal(forbiddenAssignRes.statusCode, 403);
    console.log("  ✓ Non-admin caller rejected with HTTP 403 Forbidden");

    // ────────────────────────────────────────────────────────────
    // Test 2: Admin Successfully Assigns Ticket
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 2] Admin Ticket Assignment");
    const assignRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${ticketId}/assign`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
      payload: {
        assignedTo: agentId,
        assignedTeam: "SELLER_OPS",
        notes:
          "Assigned to seller operations specialist for payout verification.",
      },
    });
    assert.equal(assignRes.statusCode, 201);
    const assignData = JSON.parse(assignRes.payload).data;
    assert.equal(assignData.ticket.assignedAgentId, agentId);
    assert.equal(assignData.ticket.assignedTeam, "SELLER_OPS");
    assert.equal(assignData.ticket.status, "IN_PROGRESS");
    assert.equal(assignData.assignment.assignedTo, agentId);
    assert.equal(assignData.assignment.assignedTeam, "SELLER_OPS");
    console.log(
      `  ✓ Assigned ticket to agent ${agentId} under team SELLER_OPS; status moved to IN_PROGRESS`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 3: Non-Admin Forbidden from Escalating
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 3] Escalation Security Guard");
    const forbiddenEscalateRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${ticketId}/escalate`,
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
      payload: {
        escalationReason: "Customer wants immediate escalation",
      },
    });
    assert.equal(forbiddenEscalateRes.statusCode, 403);
    console.log(
      "  ✓ Non-admin caller rejected from escalation with HTTP 403 Forbidden",
    );

    // ────────────────────────────────────────────────────────────
    // Test 4: Admin Successfully Escalates Ticket
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Admin Ticket Escalation");
    const escalateRes = await fastify.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${ticketId}/escalate`,
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
      payload: {
        escalationReason:
          "Unresolved seller commission ledger anomaly exceeding threshold.",
        targetTeam: "ESCALATIONS",
        priority: "CRITICAL",
      },
    });
    assert.equal(escalateRes.statusCode, 201);
    const escalatedTicket = JSON.parse(escalateRes.payload).data;
    assert.equal(escalatedTicket.isEscalated, true);
    assert.ok(escalatedTicket.escalatedAt);
    assert.equal(escalatedTicket.status, "ESCALATED");
    assert.equal(escalatedTicket.priority, "CRITICAL");
    assert.equal(escalatedTicket.assignedTeam, "ESCALATIONS");
    console.log(
      "  ✓ Ticket escalated: isEscalated=true, priority=CRITICAL, targetTeam=ESCALATIONS",
    );

    // ────────────────────────────────────────────────────────────
    // Test 5: SLA Policies Listing
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 5] SLA Policies Configuration");
    const slaPoliciesRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/support/sla-policies",
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
    });
    assert.equal(slaPoliciesRes.statusCode, 200);
    const slaPolicies = JSON.parse(slaPoliciesRes.payload).data;
    assert.ok(Array.isArray(slaPolicies));
    assert.ok(slaPolicies.length >= 5);
    const criticalPolicy = slaPolicies.find(
      (p: any) => p.priority === "CRITICAL",
    );
    assert.ok(criticalPolicy);
    assert.equal(criticalPolicy.firstResponseTimeMinutes, 15);
    console.log(
      `  ✓ Loaded ${slaPolicies.length} SLA policies; Critical SLA firstResponse=${criticalPolicy.firstResponseTimeMinutes}m`,
    );

    // ────────────────────────────────────────────────────────────
    // Test 6: Resolution Analytics & Workload Views
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 6] Resolution Analytics & Workload Views");
    // Non-admin blocked
    const forbiddenAnalyticsRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/support/analytics",
      headers: {
        "x-user-id": customerId,
        "x-user-role": "user",
      },
    });
    assert.equal(forbiddenAnalyticsRes.statusCode, 403);
    console.log("  ✓ Non-admin blocked from viewing analytics (HTTP 403)");

    // Admin retrieves analytics
    const analyticsRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/support/analytics",
      headers: {
        "x-user-id": adminId,
        "x-user-role": "admin",
      },
    });
    assert.equal(analyticsRes.statusCode, 200);
    const analytics = JSON.parse(analyticsRes.payload).data;
    assert.ok(analytics.totalTickets >= 1);
    assert.ok(analytics.statusBreakdown);
    assert.ok(analytics.priorityBreakdown);
    assert.ok(analytics.teamBreakdown);
    assert.ok(analytics.slaMetrics);
    assert.ok(Array.isArray(analytics.agentWorkload));

    const agentItem = analytics.agentWorkload.find(
      (w: any) => w.agentId === agentId,
    );
    assert.ok(agentItem, "Agent workload should track active ticket");
    assert.ok(agentItem.activeTickets >= 1);
    console.log("  ✓ Resolution analytics calculated:");
    console.log(`     Total Tickets: ${analytics.totalTickets}`);
    console.log(
      `     Active Agent Workload: ${JSON.stringify(analytics.agentWorkload)}`,
    );
    console.log(`     SLA Metrics: ${JSON.stringify(analytics.slaMetrics)}`);

    console.log("\n==================================================");
    console.log("  ALL SLA & ESCALATION TESTS PASSED (6/6)        ");
    console.log("==================================================");
  } finally {
    await app.close();
  }
}

runSlaAndEscalationTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
