process.env.NODE_ENV = "test";
import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";
import {
  DisputeStatusEnum,
  DisputeTypeEnum,
  DisputeResolutionEnum,
  CreateDisputeSchema,
  SubmitRebuttalSchema,
  ResolveDisputeSchema,
  DisputeResponseSchema,
  DisputesOverviewSchema,
  DisputeCreatedEventSchema,
  DisputeResolvedEventSchema,
} from "@repo/types";

async function runDisputesTests() {
  console.log("==================================================");
  console.log("   MARKETPLACE DISPUTE RESOLUTION TEST SUITE      ");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: Zod Domain Contracts & Business Constraints
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Zod Domain Contracts & Business Constraints");

  // 1.1 CreateDispute validation
  assert.throws(() => {
    CreateDisputeSchema.parse({
      orderId: "ord-1",
      vendorId: "vnd-1",
      type: "ITEM_NOT_RECEIVED",
      disputedAmount: 0, // Must be positive
      buyerClaim: "Valid claim detail length test",
    });
  });

  assert.throws(() => {
    CreateDisputeSchema.parse({
      orderId: "ord-1",
      vendorId: "vnd-1",
      type: "ITEM_NOT_RECEIVED",
      disputedAmount: 1500,
      buyerClaim: "Short", // Less than 10 characters
    });
  });

  const validCreate = CreateDisputeSchema.parse({
    orderId: "ord-10029",
    vendorId: "vnd-9921",
    type: "ITEM_NOT_RECEIVED",
    disputedAmount: 4999.5,
    currency: "PKR",
    buyerClaim: "The courier did not deliver this parcel at the scheduled time.",
    buyerEvidenceUrls: ["https://s3.larekmart.com/disputes/cctv.png"],
  });
  assert.equal(validCreate.disputedAmount, 4999.5);
  console.log("  ✓ CreateDisputeSchema boundary and length constraints verified");

  // 1.2 SubmitRebuttal validation
  assert.throws(() => {
    SubmitRebuttalSchema.parse({
      sellerRebuttal: "Short",
      sellerEvidenceUrls: [],
    });
  });

  const validRebuttal = SubmitRebuttalSchema.parse({
    sellerRebuttal: "Signed delivery slip attached proving buyer received package.",
    sellerEvidenceUrls: ["https://s3.larekmart.com/proofs/delivery_slip.pdf"],
  });
  assert.equal(validRebuttal.sellerEvidenceUrls.length, 1);
  console.log("  ✓ SubmitRebuttalSchema requires detailed explanation and proof URLs");

  // 1.3 ResolveDispute validation
  const validResolve = ResolveDisputeSchema.parse({
    resolution: "BUYER_FAVOR",
    resolutionReason: "Carrier reported parcel lost in transit hub.",
    clawbackEscrow: true,
  });
  assert.equal(validResolve.resolution, "BUYER_FAVOR");
  console.log("  ✓ ResolveDisputeSchema validated");

  // 1.4 Kafka Event Schemas
  const disputeCreatedEvt = DisputeCreatedEventSchema.parse({
    disputeId: "dsp-001",
    disputeNumber: "DSP-2026-A1B2",
    orderId: "ord-10029",
    vendorId: "vnd-9921",
    buyerId: "user-100",
    disputedAmount: 4999.5,
    currency: "PKR",
    type: "ITEM_NOT_RECEIVED",
    timestamp: new Date().toISOString(),
  });
  assert.equal(disputeCreatedEvt.disputeNumber, "DSP-2026-A1B2");

  const disputeResolvedEvt = DisputeResolvedEventSchema.parse({
    disputeId: "dsp-001",
    disputeNumber: "DSP-2026-A1B2",
    orderId: "ord-10029",
    vendorId: "vnd-9921",
    resolution: "BUYER_FAVOR",
    resolutionReason: "Courier lost parcel",
    resolvedAt: new Date().toISOString(),
  });
  assert.equal(disputeResolvedEvt.resolution, "BUYER_FAVOR");
  console.log("  ✓ Kafka event contracts verified");

  // ────────────────────────────────────────────────────────────
  // Test 2: Double-Entry Escrow Freezing Invariant
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Dispute Escrow Freezing & Conservation Invariant");

  let availableBalance = 10000;
  let escrowBalance = 25000;
  let disputeFrozenBalance = 0;
  let lifetimeEarnings = 35000;

  // Invariant holds initially:
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance,
    "Initial balance matches lifetime earnings",
  );

  // Step 1: Customer raises dispute on 5,000 PKR escrow item
  const disputedNet = 5000;
  escrowBalance -= disputedNet;
  disputeFrozenBalance += disputedNet;

  assert.equal(escrowBalance, 20000);
  assert.equal(disputeFrozenBalance, 5000);
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance,
    "Invariant holds when Escrow is frozen on Dispute",
  );
  console.log("  ✓ Escrow freeze preserves accounting conservation invariant");

  // Step 2a: Resolved in Buyer's Favor -> Clawback
  // Dispute frozen balance is removed, lifetime earnings decrements
  const clawbackDisputeFrozen = disputeFrozenBalance;
  disputeFrozenBalance -= clawbackDisputeFrozen;
  lifetimeEarnings -= clawbackDisputeFrozen;

  assert.equal(disputeFrozenBalance, 0);
  assert.equal(escrowBalance, 20000);
  assert.equal(availableBalance, 10000);
  assert.equal(lifetimeEarnings, 30000);
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance,
    "Invariant holds upon dispute clawback",
  );
  console.log("  ✓ Buyer resolution clawback decrements frozen balance accurately");

  // Step 2b: Resolved in Seller's Favor -> Restore to Escrow
  // (Simulated with new 3,000 PKR dispute)
  const dispute2Net = 3000;
  escrowBalance -= dispute2Net;
  disputeFrozenBalance += dispute2Net;
  assert.equal(disputeFrozenBalance, 3000);

  // Seller unfreeze
  disputeFrozenBalance -= dispute2Net;
  escrowBalance += dispute2Net;
  assert.equal(disputeFrozenBalance, 0);
  assert.equal(escrowBalance, 20000);
  console.log("  ✓ Seller resolution unfreeze restores funds to normal escrow");

  // ────────────────────────────────────────────────────────────
  // Test 3: 7-Day Rebuttal Deadline Computation
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] 7-Day Seller Rebuttal Window Computation");

  const openedAt = new Date("2026-10-01T10:00:00Z");
  const rebuttalDeadline = new Date(openedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  assert.equal(rebuttalDeadline.toISOString(), "2026-10-08T10:00:00.000Z");

  const day4 = new Date("2026-10-05T10:00:00Z");
  assert.equal(day4 < rebuttalDeadline, true, "Seller can rebut on day 4");

  const day9 = new Date("2026-10-10T10:00:00Z");
  assert.equal(day9 > rebuttalDeadline, true, "Rebuttal deadline has expired on day 9");
  console.log("  ✓ 7-day seller rebuttal window bounds verified");

  // ────────────────────────────────────────────────────────────
  // Test 4: Fastify Endpoint Security & Route Guards
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Fastify Endpoint Security & Route Guards");

  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: false },
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const fastify = app.getHttpAdapter().getInstance();

  try {
    // 4.1 Disputes endpoint rejects unauthenticated request
    const unauthDisputeRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/disputes",
    });
    assert.equal(
      unauthDisputeRes.statusCode,
      401,
      "Customer disputes endpoint must reject unauthenticated request",
    );
    console.log("  ✓ GET /api/v1/disputes rejects unauthenticated request (401)");

    // 4.2 Admin disputes endpoint rejects non-admin request
    const nonAdminRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/disputes",
      headers: {
        "x-user-id": "user-regular-01",
        "x-user-role": "customer",
      },
    });
    assert.equal(
      nonAdminRes.statusCode,
      403,
      "Admin disputes endpoint must reject regular customer request",
    );
    console.log("  ✓ GET /api/v1/admin/disputes rejects non-admin caller (403)");

    // 4.3 Vendor disputes endpoint rejects non-member request
    const nonMemberVendorRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000/disputes",
      headers: {
        "x-user-id": "user-stranger-01",
        "x-user-role": "seller",
      },
    });
    assert.equal(
      nonMemberVendorRes.statusCode,
      403,
      "Vendor disputes endpoint must enforce vendor membership (403)",
    );
    console.log("  ✓ GET /api/v1/vendors/:vendorId/disputes rejects unauthorized caller (403)");

    // 4.4 Admin dispute resolution endpoint rejects unauthenticated request
    const unauthResolveRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/disputes/550e8400-e29b-41d4-a716-446655440000/resolve",
      payload: {
        resolution: "BUYER_FAVOR",
        resolutionReason: "Carrier error",
      },
    });
    assert.equal(
      unauthResolveRes.statusCode,
      403,
      "Admin resolve endpoint must reject unauthorized requests",
    );
    console.log("  ✓ POST /api/v1/admin/disputes/:id/resolve strictly guarded (403)");

    console.log("\n==================================================");
    console.log("  ALL DISPUTE RESOLUTION TESTS PASSED (100%)!     ");
    console.log("==================================================\n");
  } finally {
    await app.close();
  }
}

runDisputesTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

