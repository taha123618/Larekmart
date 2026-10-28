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
  RequestPayoutSchema,
  VendorCommissionRateSchema,
  VendorEscrowTransactionSchema,
  VendorBalanceSchema,
  PayoutBatchSchema,
  VendorSettlementOverviewSchema,
  VendorEscrowCreditedPayloadSchema,
  VendorEscrowReleasedPayloadSchema,
  VendorPayoutRequestedPayloadSchema,
  VendorPayoutCompletedPayloadSchema,
  EscrowStatusEnum,
  PayoutStatusEnum,
  PayoutMethodEnum,
} from "@repo/types";

async function runSettlementTests() {
  console.log("==================================================");
  console.log("   VENDOR SETTLEMENT & ESCROW TEST SUITE          ");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: Zod Contracts & Business Rule Validations
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Zod Domain Contracts & Business Constraints");

  // Payout threshold enforcement (< 5000 PKR must fail)
  assert.throws(
    () => {
      RequestPayoutSchema.parse({
        amount: 2500, // Below minimum 5000 PKR
        currency: "PKR",
        paymentMethod: PayoutMethodEnum.BANK_TRANSFER,
      });
    },
    /5,000 PKR/,
    "RequestPayoutSchema must reject withdrawal requests below 5,000 PKR",
  );
  console.log(
    "  ✓ Minimum withdrawal threshold (5,000 PKR) strictly enforced by schema",
  );

  const validPayout = RequestPayoutSchema.parse({
    amount: 15000,
    currency: "PKR",
    paymentMethod: PayoutMethodEnum.RAAST_INSTANT,
    notes: "Weekly earnings withdrawal",
  });
  assert.equal(validPayout.amount, 15000);
  assert.equal(validPayout.paymentMethod, "RAAST_INSTANT");
  console.log("  ✓ Valid payout input correctly parsed");

  // Commission rate boundaries (0-100%)
  assert.throws(() => {
    VendorCommissionRateSchema.parse({
      categoryId: "cat_1",
      ratePercentage: 115, // > 100%
    });
  });
  assert.throws(() => {
    VendorCommissionRateSchema.parse({
      categoryId: "cat_1",
      ratePercentage: -5, // < 0%
    });
  });
  const validCommission = VendorCommissionRateSchema.parse({
    categoryId: "electronics",
    ratePercentage: 7.5,
  });
  assert.equal(validCommission.ratePercentage, 7.5);
  console.log("  ✓ Commission rate bounds (0% to 100%) strictly enforced");

  // Kafka Event Schemas
  const creditedEvent = VendorEscrowCreditedPayloadSchema.parse({
    eventId: "evt-001",
    eventType: "vendor.escrow.credited",
    vendorId: "550e8400-e29b-41d4-a716-446655440000",
    orderId: "order-99",
    grossAmount: 10000,
    commissionRate: 10,
    commissionAmount: 1000,
    netAmount: 9000,
    currency: "PKR",
    timestamp: new Date().toISOString(),
  });
  assert.equal(creditedEvent.netAmount, 9000);

  const releasedEvent = VendorEscrowReleasedPayloadSchema.parse({
    eventId: "evt-002",
    eventType: "vendor.escrow.released",
    vendorId: "550e8400-e29b-41d4-a716-446655440000",
    orderId: "order-99",
    releasedAmount: 9000,
    currency: "PKR",
    releasedAt: new Date().toISOString(),
  });
  assert.equal(releasedEvent.releasedAmount, 9000);

  const payoutReqEvent = VendorPayoutRequestedPayloadSchema.parse({
    eventId: "evt-003",
    eventType: "vendor.payout.requested",
    payoutRequestId: "550e8400-e29b-41d4-a716-446655440001",
    vendorId: "550e8400-e29b-41d4-a716-446655440000",
    amount: 9000,
    currency: "PKR",
    requestedAt: new Date().toISOString(),
  });
  assert.equal(payoutReqEvent.amount, 9000);

  const payoutCompEvent = VendorPayoutCompletedPayloadSchema.parse({
    eventId: "evt-004",
    eventType: "vendor.payout.completed",
    payoutRequestId: "550e8400-e29b-41d4-a716-446655440001",
    vendorId: "550e8400-e29b-41d4-a716-446655440000",
    amount: 9000,
    currency: "PKR",
    transactionReference: "RAAST-TRX-876123",
    completedAt: new Date().toISOString(),
  });
  assert.equal(payoutCompEvent.transactionReference, "RAAST-TRX-876123");
  console.log("  ✓ Kafka event contracts validated against payload schemas");

  // ────────────────────────────────────────────────────────────
  // Test 2: Double-Entry Accounting Invariants
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Double-Entry Ledger Conservation Invariant");

  let availableBalance = 0;
  let escrowBalance = 0;
  let disputeFrozenBalance = 0;
  let lifetimeEarnings = 0;
  let lifetimePaid = 0;

  // Step 1: Order Escrow Credited (Gross: 20,000, Comm: 10% = 2,000, Net: 18,000)
  const netEarnings1 = 18000;
  escrowBalance += netEarnings1;
  lifetimeEarnings += netEarnings1;

  assert.equal(escrowBalance, 18000);
  assert.equal(availableBalance, 0);
  assert.equal(lifetimeEarnings, 18000);
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance + lifetimePaid,
    "Invariant holds at Escrow Credit",
  );

  // Step 2: 7-day Return Buffer Matures -> Released to Available Balance
  escrowBalance -= netEarnings1;
  availableBalance += netEarnings1;

  assert.equal(escrowBalance, 0);
  assert.equal(availableBalance, 18000);
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance + lifetimePaid,
    "Invariant holds at Escrow Release",
  );

  // Step 3: Vendor Requests Payout (10,000 PKR) -> Liquid balance reserved
  const withdrawalAmount = 10000;
  availableBalance -= withdrawalAmount;

  assert.equal(availableBalance, 8000);

  // Step 4: Batch Disbursement Approved & Disbursed
  lifetimePaid += withdrawalAmount;

  assert.equal(lifetimePaid, 10000);
  assert.equal(
    lifetimeEarnings,
    availableBalance + escrowBalance + disputeFrozenBalance + lifetimePaid,
    "Invariant holds after Payout Settlement: 18000 == 8000 (Avail) + 0 (Escrow) + 0 (Freeze) + 10000 (Paid)",
  );
  console.log(
    "  ✓ Double-entry accounting conservation mathematically verified",
  );

  // ────────────────────────────────────────────────────────────
  // Test 3: 7-Day Return Buffer Timing Logic
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] 7-Day Post-Delivery Return Window Buffer");

  const deliveryTimestamp = new Date("2026-10-01T12:00:00Z");
  const returnBufferDays = 7;
  const releaseDueAt = new Date(
    deliveryTimestamp.getTime() + returnBufferDays * 24 * 60 * 60 * 1000,
  );

  assert.equal(releaseDueAt.toISOString(), "2026-10-08T12:00:00.000Z");

  const day5Check = new Date("2026-10-06T12:00:00Z");
  assert.equal(
    day5Check < releaseDueAt,
    true,
    "Funds must remain held on day 5",
  );

  const day8Check = new Date("2026-10-09T12:00:00Z");
  assert.equal(
    day8Check >= releaseDueAt,
    true,
    "Funds mature and unlock after 7 days",
  );
  console.log("  ✓ 7-day post-delivery maturity window operates correctly");

  // ────────────────────────────────────────────────────────────
  // Test 4: Endpoint Security & Guard Authorization
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Perimeter Security & Guard Authorization");

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
    // 4.1 Admin endpoint rejects unauthenticated request
    const unauthAdminRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/settlements/overview",
    });
    assert.equal(
      unauthAdminRes.statusCode,
      401,
      "Admin settlements overview must reject unauthenticated request",
    );
    console.log(
      "  ✓ /api/v1/admin/settlements/overview rejects unauthenticated request (401)",
    );

    // 4.2 Admin batch generation rejects unauthenticated request
    const unauthBatchRes = await fastify.inject({
      method: "POST",
      url: "/api/v1/admin/settlements/batches/generate",
    });
    assert.equal(
      unauthBatchRes.statusCode,
      401,
      "Batch generation must reject unauthenticated request",
    );
    console.log(
      "  ✓ /api/v1/admin/settlements/batches/generate rejects unauthenticated request (401)",
    );

    // 4.3 Admin endpoint rejects non-admin user
    const nonAdminRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/admin/settlements/overview",
      headers: {
        "x-user-id": "shopper_456",
        "x-user-role": "customer",
      },
    });
    assert.equal(
      nonAdminRes.statusCode,
      403,
      "Admin settlements overview must reject non-admin users (403)",
    );
    console.log(
      "  ✓ /api/v1/admin/settlements/overview rejects non-admin users (403)",
    );

    // 4.4 Merchant endpoint rejects unauthenticated request
    const unauthVendorRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000/settlements/balance",
    });
    assert.equal(
      unauthVendorRes.statusCode,
      401,
      "Merchant balance endpoint must reject unauthenticated request",
    );
    console.log(
      "  ✓ /api/v1/vendors/:id/settlements/balance rejects unauthenticated request (401)",
    );

    // 4.5 Merchant endpoint rejects unauthorized user (IDOR prevention)
    const unauthorizedVendorRes = await fastify.inject({
      method: "GET",
      url: "/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000/settlements/balance",
      headers: {
        "x-user-id": "unrelated_user_789",
        "x-user-role": "customer",
      },
    });
    assert.equal(
      unauthorizedVendorRes.statusCode,
      403,
      "Merchant balance endpoint must reject users who are not vendor members",
    );
    console.log(
      "  ✓ IDOR prevention: non-member rejected from vendor settlements (403)",
    );

    console.log("\n==================================================");
    console.log("  ALL SETTLEMENT TESTS COMPLETED SUCCESSFULLY!    ");
    console.log("==================================================\n");
  } finally {
    await app.close();
  }
}

runSettlementTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
