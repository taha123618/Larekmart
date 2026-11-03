import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { MockBankAdapter } from "../src/providers/mock-bank-adapter.js";
import { env } from "../src/config/env.js";
import Decimal from "decimal.js";

async function runTests() {
  console.log("=== payout-service Test Suite ===");

  // ────────────────────────────────────────────────────────────
  // Test 1: Balanced Double-Entry Accounting Invariant
  // ────────────────────────────────────────────────────────────
  console.log("1. Testing balanced double-entry accounting invariants...");
  const ledgerService = new LedgerService();

  // Balanced transaction: Credit 1000, Debit 1000
  const balancedResult = await ledgerService.postBalancedTransaction([
    {
      accountId: "acc_escrow_seller_1",
      entryType: "CREDIT",
      amount: "1000.00",
      currency: "PKR",
      referenceType: "ORDER_PAYMENT",
      referenceId: "ord_001",
    },
    {
      accountId: "acc_platform_commission",
      entryType: "DEBIT",
      amount: "1000.00",
      currency: "PKR",
      referenceType: "ORDER_PAYMENT",
      referenceId: "ord_001",
    },
  ]);

  assert.ok(balancedResult.transactionId);
  assert.equal(balancedResult.entriesCount, 2);
  console.log("  ✓ Balanced transaction accepted (Debits === Credits)");

  // Unbalanced transaction: Credit 1000, Debit 900 -> Must throw!
  await assert.rejects(
    async () => {
      await ledgerService.postBalancedTransaction([
        {
          accountId: "acc_escrow_seller_1",
          entryType: "CREDIT",
          amount: "1000.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_002",
        },
        {
          accountId: "acc_platform_commission",
          entryType: "DEBIT",
          amount: "900.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_002",
        },
      ]);
    },
    /Unbalanced double-entry transaction/,
    "Unbalanced entry must be rejected",
  );
  console.log("  ✓ Unbalanced transaction rejected strictly");

  // Negative amount -> Must throw!
  await assert.rejects(
    async () => {
      await ledgerService.postBalancedTransaction([
        {
          accountId: "acc_escrow_seller_1",
          entryType: "CREDIT",
          amount: "-50.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_003",
        },
        {
          accountId: "acc_platform_commission",
          entryType: "DEBIT",
          amount: "-50.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_003",
        },
      ]);
    },
    /non-negative/,
    "Negative amounts must be rejected",
  );
  console.log("  ✓ Negative ledger amounts strictly rejected");

  // ────────────────────────────────────────────────────────────
  // Test 2: Provider Adapter Interface
  // ────────────────────────────────────────────────────────────
  console.log("2. Testing Payout Provider Adapter...");
  const provider = new MockBankAdapter();
  assert.equal(provider.providerName, "MOCK_BANK");

  const disburseRes = await provider.disburse({
    payoutId: "pay_test_01",
    payoutNumber: "PAY_001",
    sellerId: "seller_test",
    amount: 5000,
    currency: "PKR",
    accountHolderName: "Test Merchant",
    accountNumberMasked: "******5678",
    routingOrIban: "PK00TEST",
    idempotencyKey: "idemp_test_01",
  });

  assert.equal(disburseRes.success, true);
  assert.equal(disburseRes.providerStatus, "SUBMITTED");
  assert.ok(disburseRes.providerReference.startsWith("ach_mock_"));
  console.log("  ✓ Provider adapter disburse and reference tracking verified");

  // ────────────────────────────────────────────────────────────
  // Test 3: NestJS HTTP Server & Zero-Trust Auth Gates
  // ────────────────────────────────────────────────────────────
  console.log("3. Testing NestJS HTTP Server & Security Gates...");
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const fastify = app.getHttpAdapter().getInstance();

  // Health endpoint
  const healthRes = await fastify.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok([200, 503].includes(healthRes.statusCode));
  const health = JSON.parse(healthRes.body);
  assert.equal(health.service, "payout-service");
  console.log("  ✓ /health endpoint verified");

  // Metrics endpoint
  const metricsRes = await fastify.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200);
  console.log("  ✓ /metrics endpoint verified");

  // Internal schedule without secret -> 401
  const internalUnauth = await fastify.inject({
    method: "POST",
    url: "/api/v1/internal/payouts/schedule",
    payload: {
      currency: "PKR",
      minimumThreshold: 500,
      idempotencyKey: "test_key_unauth_1234",
    },
  });
  assert.equal(internalUnauth.statusCode, 401);
  console.log("  ✓ Internal route without secret rejected (401)");

  // Internal schedule with valid secret -> 201
  const internalAuth = await fastify.inject({
    method: "POST",
    url: "/api/v1/internal/payouts/schedule",
    headers: {
      "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
    },
    payload: {
      currency: "PKR",
      minimumThreshold: 500,
      idempotencyKey: `test_key_auth_${Date.now()}`,
    },
  });
  assert.equal(internalAuth.statusCode, 201);
  const schedBody = JSON.parse(internalAuth.body);
  assert.ok(schedBody.batchId);
  console.log("  ✓ Internal schedule endpoint authenticated and executed");

  // Admin payouts without admin role -> 403
  const adminUnauth = await fastify.inject({
    method: "GET",
    url: "/api/v1/admin/payouts",
    headers: {
      "x-user-role": "customer",
    },
  });
  assert.equal(adminUnauth.statusCode, 403);
  console.log("  ✓ Admin route without role rejected (403)");

  // Admin payouts with admin role -> 200
  const adminAuth = await fastify.inject({
    method: "GET",
    url: "/api/v1/admin/payouts",
    headers: {
      "x-user-role": "admin",
    },
  });
  assert.equal(adminAuth.statusCode, 200);
  console.log("  ✓ Admin route with admin role authorized (200)");

  // Seller balance endpoint -> 200
  const sellerBalanceRes = await fastify.inject({
    method: "GET",
    url: "/api/v1/sellers/me/balance",
    headers: {
      "x-user-id": "seller_demo_01",
    },
  });
  assert.equal(sellerBalanceRes.statusCode, 200);
  const bal = JSON.parse(sellerBalanceRes.body);
  assert.ok(bal.availableBalance !== undefined);
  assert.ok(bal.reserveHold !== undefined);
  console.log("  ✓ Seller balance derived from authoritative ledger (200)");

  await app.close();
  console.log("==========================================");
  console.log("🎉 All payout-service tests passed cleanly!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
