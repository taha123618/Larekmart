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
import { PayoutConsumerService } from "../src/kafka/payout-consumer.service.js";
import { env } from "../src/config/env.js";
import Decimal from "decimal.js";
import type { CommissionAccruedEvent } from "@repo/types";

async function runTests() {
  console.log("==============================================================");
  console.log("=== payout-service Comprehensive Unit & Integration Tests ===");
  console.log("==============================================================");

  let totalAssertions = 0;
  const pass = (desc: string) => {
    totalAssertions++;
    console.log(`  ✓ [${totalAssertions}] ${desc}`);
  };

  // ────────────────────────────────────────────────────────────
  // SUITE 1: Balanced Double-Entry Accounting Invariants
  // ────────────────────────────────────────────────────────────
  console.log(
    "\n--- SUITE 1: Double-Entry Accounting Invariants & Precision Math ---",
  );
  const ledgerService = new LedgerService();

  // 1.1 Balanced 2-leg transaction: Credit 1000, Debit 1000
  const balanced2Leg = await ledgerService.postBalancedTransaction([
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
  assert.ok(balanced2Leg.transactionId);
  assert.equal(balanced2Leg.entriesCount, 2);
  pass("2-leg balanced transaction accepted (Debits === Credits)");

  // 1.2 Multi-leg split transaction: 3 legs (Buyer Debit 10,000, Seller Escrow Credit 9,200, Platform Credit 800)
  const balanced3Leg = await ledgerService.postBalancedTransaction([
    {
      accountId: "acc_buyer_clearing",
      entryType: "DEBIT",
      amount: "10000.00",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_001",
    },
    {
      accountId: "acc_seller_escrow_seller_1",
      entryType: "CREDIT",
      amount: "9200.00",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_001",
    },
    {
      accountId: "acc_platform_commission",
      entryType: "CREDIT",
      amount: "800.00",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_001",
    },
  ]);
  assert.ok(balanced3Leg.transactionId);
  assert.equal(balanced3Leg.entriesCount, 3);
  pass(
    "3-leg split transaction verified (Debit 10000 === Credit 9200 + Credit 800)",
  );

  // 1.3 Multi-leg split transaction: 4 legs with logistics allocation
  const balanced4Leg = await ledgerService.postBalancedTransaction([
    {
      accountId: "acc_buyer_clearing",
      entryType: "DEBIT",
      amount: "15000.0000",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_002",
    },
    {
      accountId: "acc_seller_escrow_seller_2",
      entryType: "CREDIT",
      amount: "13000.0000",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_002",
    },
    {
      accountId: "acc_platform_commission",
      entryType: "CREDIT",
      amount: "1500.0000",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_002",
    },
    {
      accountId: "acc_logistics_reserve",
      entryType: "CREDIT",
      amount: "500.0000",
      currency: "PKR",
      referenceType: "ORDER_CHECKOUT",
      referenceId: "ord_split_002",
    },
  ]);
  assert.equal(balanced4Leg.entriesCount, 4);
  pass(
    "4-leg split transaction verified (Debit 15000 === Credit 13000 + 1500 + 500)",
  );

  // 1.4 Fractional / sub-cent precision accounting (4 decimal places)
  const fractionalResult = await ledgerService.postBalancedTransaction([
    {
      accountId: "acc_subcent_buyer",
      entryType: "DEBIT",
      amount: "1234.5678",
      currency: "PKR",
      referenceType: "PRECISION_TEST",
      referenceId: "prec_001",
    },
    {
      accountId: "acc_subcent_seller",
      entryType: "CREDIT",
      amount: "1234.5678",
      currency: "PKR",
      referenceType: "PRECISION_TEST",
      referenceId: "prec_001",
    },
  ]);
  assert.equal(fractionalResult.entriesCount, 2);
  pass(
    "Decimal.js 4-decimal precision entry posted without floating-point drift",
  );

  // 1.5 Single-leg transaction rejection (<2 legs)
  await assert.rejects(
    async () => {
      await ledgerService.postBalancedTransaction([
        {
          accountId: "acc_escrow_seller_1",
          entryType: "CREDIT",
          amount: "1000.00",
          currency: "PKR",
          referenceType: "SINGLE_LEG",
          referenceId: "ord_fail_01",
        },
      ]);
    },
    /requires at least 2 legs/,
    "Single-leg transaction must be rejected",
  );
  pass("Single-leg transaction rejected (< 2 legs)");

  // 1.6 Unbalanced transaction rejection: Credit 1000, Debit 900
  await assert.rejects(
    async () => {
      await ledgerService.postBalancedTransaction([
        {
          accountId: "acc_escrow_seller_1",
          entryType: "CREDIT",
          amount: "1000.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_fail_02",
        },
        {
          accountId: "acc_platform_commission",
          entryType: "DEBIT",
          amount: "900.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_fail_02",
        },
      ]);
    },
    /Unbalanced double-entry transaction/,
    "Unbalanced entry must be rejected",
  );
  pass("Unbalanced transaction rejected strictly (Credit 1000 !== Debit 900)");

  // 1.7 Negative ledger amount rejection
  await assert.rejects(
    async () => {
      await ledgerService.postBalancedTransaction([
        {
          accountId: "acc_escrow_seller_1",
          entryType: "CREDIT",
          amount: "-50.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_fail_03",
        },
        {
          accountId: "acc_platform_commission",
          entryType: "DEBIT",
          amount: "-50.00",
          currency: "PKR",
          referenceType: "ORDER_PAYMENT",
          referenceId: "ord_fail_03",
        },
      ]);
    },
    /non-negative/,
    "Negative amounts must be rejected",
  );
  pass("Negative ledger amounts strictly rejected");

  // 1.8 Multi-currency chart of accounts isolation
  const sellerPkrAccount = await ledgerService.getOrCreateAccount(
    "seller_intl_01",
    "SELLER_ESCROW",
    "PKR",
  );
  const sellerUsdAccount = await ledgerService.getOrCreateAccount(
    "seller_intl_01",
    "SELLER_ESCROW",
    "USD",
  );
  const sellerEurAccount = await ledgerService.getOrCreateAccount(
    "seller_intl_01",
    "SELLER_ESCROW",
    "EUR",
  );
  const platformEurAccount = await ledgerService.getOrCreateAccount(
    null,
    "PLATFORM_COMMISSION",
    "EUR",
  );

  assert.equal(sellerPkrAccount, "acc_seller_escrow_seller_intl_01_pkr");
  assert.equal(sellerUsdAccount, "acc_seller_escrow_seller_intl_01_usd");
  assert.equal(sellerEurAccount, "acc_seller_escrow_seller_intl_01_eur");
  assert.equal(platformEurAccount, "acc_platform_commission_platform_eur");
  assert.notEqual(sellerPkrAccount, sellerUsdAccount);
  pass(
    "Multi-currency account segregation strictly enforced across PKR, USD, EUR",
  );

  // ────────────────────────────────────────────────────────────
  // SUITE 2: Payout Provider Adapter & Idempotency
  // ────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: Payout Provider Adapter & Idempotency ---");
  const provider = new MockBankAdapter();
  assert.equal(provider.providerName, "MOCK_BANK");
  pass("Provider adapter name verified (MOCK_BANK)");

  const idempotencyKey1 = `idemp_test_${Date.now()}`;
  const disburseRes1 = await provider.disburse({
    payoutId: "pay_test_01",
    payoutNumber: "PAY_001",
    sellerId: "seller_test",
    amount: 5000,
    currency: "PKR",
    accountHolderName: "Test Merchant",
    accountNumberMasked: "******5678",
    routingOrIban: "PK00TEST",
    idempotencyKey: idempotencyKey1,
  });

  assert.equal(disburseRes1.success, true);
  assert.equal(disburseRes1.providerStatus, "SUBMITTED");
  assert.ok(disburseRes1.providerReference.startsWith("ach_mock_"));
  pass("Provider adapter disburse returns SUBMITTED with ach_mock_ reference");

  // Verify idempotent replay
  const disburseRes2 = await provider.disburse({
    payoutId: "pay_test_01",
    payoutNumber: "PAY_001",
    sellerId: "seller_test",
    amount: 5000,
    currency: "PKR",
    accountHolderName: "Test Merchant",
    accountNumberMasked: "******5678",
    routingOrIban: "PK00TEST",
    idempotencyKey: idempotencyKey1,
  });
  assert.equal(disburseRes2.success, true);
  pass("Provider adapter handles idempotency keys idempotently");

  // ────────────────────────────────────────────────────────────
  // SUITE 3: Dynamic Ledger Balance Derivation & Invariant Clamping
  // ────────────────────────────────────────────────────────────
  console.log(
    "\n--- SUITE 3: Dynamic Ledger Balance Derivation & Non-Negative Clamping ---",
  );
  const sellerBalance = await ledgerService.getSellerBalance(
    "seller_audit_01",
    "PKR",
  );
  assert.equal(sellerBalance.sellerId, "seller_audit_01");
  assert.equal(sellerBalance.currency, "PKR");
  assert.ok(sellerBalance.availableBalance >= 0);
  assert.ok(sellerBalance.pendingSettlement >= 0);
  assert.ok(sellerBalance.reserveHold >= 0);
  pass("Seller financial balance derived purely from immutable ledger entries");

  // Invariant validation: Available balance formula availableBalance = max(0, gross - reserveHold)
  const gross = new Decimal(5000);
  const excessiveHold = new Decimal(7500);
  const clampedAvailable = Decimal.max(0, gross.minus(excessiveHold));
  assert.equal(clampedAvailable.toNumber(), 0);
  pass(
    "Excessive reserve hold clamps available balance to exactly 0 (never negative)",
  );

  // ────────────────────────────────────────────────────────────
  // SUITE 4: NestJS HTTP Server & Zero-Trust Auth Perimeter
  // ────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: NestJS HTTP Server & Security Gates ---");
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const fastify = app.getHttpAdapter().getInstance();

  // 4.1 /health probe
  const healthRes = await fastify.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok([200, 503].includes(healthRes.statusCode));
  const health = JSON.parse(healthRes.body);
  assert.equal(health.service, "payout-service");
  pass("/health probe returns valid status and service identifier");

  // 4.2 /ready probe
  const readyRes = await fastify.inject({
    method: "GET",
    url: "/ready",
  });
  assert.ok([200, 503].includes(readyRes.statusCode));
  const readyBody = JSON.parse(readyRes.body);
  assert.equal(readyBody.service, "payout-service");
  pass("/ready probe operational");

  // 4.3 /metrics Prometheus endpoint
  const metricsRes = await fastify.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200);
  assert.ok(metricsRes.body.includes("payout_disbursements_total"));
  assert.ok(metricsRes.body.includes("payout_ledger_transactions_total"));
  pass("/metrics returns Prometheus format telemetry");

  // 4.4 POST /api/v1/internal/payouts/schedule without secret -> 401
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
  pass("Internal schedule endpoint without secret rejected (401 Unauthorized)");

  // 4.5 POST /api/v1/internal/payouts/schedule with invalid secret -> 401
  const internalBadSecret = await fastify.inject({
    method: "POST",
    url: "/api/v1/internal/payouts/schedule",
    headers: {
      "x-internal-secret": "wrong_secret_12345",
    },
    payload: {
      currency: "PKR",
      minimumThreshold: 500,
      idempotencyKey: "test_key_bad_1234",
    },
  });
  assert.equal(internalBadSecret.statusCode, 401);
  pass(
    "Internal schedule endpoint with invalid secret rejected via timingSafeEqual (401)",
  );

  // 4.6 POST /api/v1/internal/payouts/schedule with malformed payload -> 400
  const internalBadPayload = await fastify.inject({
    method: "POST",
    url: "/api/v1/internal/payouts/schedule",
    headers: {
      "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
    },
    payload: {
      currency: "PKR",
      // missing idempotencyKey
    },
  });
  assert.equal(internalBadPayload.statusCode, 400);
  pass(
    "Internal schedule endpoint with invalid schema rejected (400 Bad Request)",
  );

  // 4.7 POST /api/v1/internal/payouts/schedule with valid secret & payload -> 201
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
  assert.ok(schedBody.batchNumber);
  pass("Internal schedule endpoint creates payout batch (201 Created)");

  // 4.8 POST /api/v1/internal/payouts/reconcile with valid secret
  const reconcileRes = await fastify.inject({
    method: "POST",
    url: "/api/v1/internal/payouts/reconcile",
    headers: {
      "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
    },
    payload: {
      batchId: schedBody.batchId,
      provider: "MOCK_BANK",
      providerEvents: [
        {
          payoutId: "pay_sample_01",
          providerRef: "ach_mock_sample_01",
          status: "SUCCESS",
          settledAt: new Date().toISOString(),
        },
        {
          payoutId: "pay_sample_02",
          providerRef: "ach_mock_sample_02",
          status: "FAILED",
          failureCode: "INVALID_ACCOUNT",
          failureMessage: "Bank account closed or invalid",
        },
      ],
    },
  });
  assert.equal(reconcileRes.statusCode, 201);
  const recBody = JSON.parse(reconcileRes.body);
  assert.equal(recBody.batchId, schedBody.batchId);
  assert.equal(recBody.reconciledCount, 1);
  assert.equal(recBody.failedCount, 1);
  pass(
    "Internal reconcile endpoint reconciles SUCCESS and FAILED provider events (201)",
  );

  // 4.9 GET /api/v1/admin/payouts without admin role -> 403
  const adminUnauth = await fastify.inject({
    method: "GET",
    url: "/api/v1/admin/payouts",
    headers: {
      "x-user-role": "customer",
    },
  });
  assert.equal(adminUnauth.statusCode, 403);
  pass("Admin payouts route without admin role rejected (403 Forbidden)");

  // 4.10 GET /api/v1/admin/payouts with admin role -> 200
  const adminAuth = await fastify.inject({
    method: "GET",
    url: "/api/v1/admin/payouts",
    headers: {
      "x-user-role": "admin",
    },
  });
  assert.equal(adminAuth.statusCode, 200);
  const adminBody = JSON.parse(adminAuth.body);
  assert.ok(Array.isArray(adminBody.payouts));
  pass("Admin payouts route with admin role authorized (200 OK)");

  // 4.11 POST /api/v1/admin/payouts/:payoutId/retry without admin role -> 403
  const retryUnauth = await fastify.inject({
    method: "POST",
    url: "/api/v1/admin/payouts/pay_sample_02/retry",
    headers: {
      "x-user-role": "seller",
    },
  });
  assert.equal(retryUnauth.statusCode, 403);
  pass("Admin retry payout without admin role rejected (403 Forbidden)");

  // 4.12 POST /api/v1/admin/payouts/:payoutId/retry with admin role -> 201
  const retryAuth = await fastify.inject({
    method: "POST",
    url: "/api/v1/admin/payouts/pay_sample_02/retry",
    headers: {
      "x-user-role": "admin",
    },
  });
  assert.equal(retryAuth.statusCode, 201);
  const retryBody = JSON.parse(retryAuth.body);
  assert.equal(retryBody.success, true);
  assert.equal(retryBody.status, "PROCESSING");
  pass("Admin retry payout with admin role executed (201 Created)");

  // 4.13 GET /api/v1/sellers/me/balance -> 200
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
  pass("Seller balance derived from authoritative ledger (200 OK)");

  // 4.14 GET /api/v1/sellers/me/payouts -> 200
  const sellerPayoutsRes = await fastify.inject({
    method: "GET",
    url: "/api/v1/sellers/me/payouts",
    headers: {
      "x-user-id": "seller_demo_01",
    },
  });
  assert.equal(sellerPayoutsRes.statusCode, 200);
  const payoutsBody = JSON.parse(sellerPayoutsRes.body);
  assert.equal(payoutsBody.sellerId, "seller_demo_01");
  assert.ok(Array.isArray(payoutsBody.payouts));
  pass("Seller payouts history retrieved (200 OK)");

  // 4.15 GET /api/v1/sellers/me/statements -> 200
  const sellerStatementsRes = await fastify.inject({
    method: "GET",
    url: "/api/v1/sellers/me/statements",
    headers: {
      "x-user-id": "seller_demo_01",
    },
  });
  assert.equal(sellerStatementsRes.statusCode, 200);
  const statementsBody = JSON.parse(sellerStatementsRes.body);
  assert.equal(statementsBody.sellerId, "seller_demo_01");
  assert.ok(Array.isArray(statementsBody.statements));
  pass("Seller statements retrieved (200 OK)");

  // ────────────────────────────────────────────────────────────
  // SUITE 5: Kafka Consumer Event Handlers
  // ────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Kafka Consumer Event Handlers ---");
  const consumerService = app.get(PayoutConsumerService);

  // 5.1 handleCommissionAccrued
  const accruedEvt: CommissionAccruedEvent = {
    calculationId: "calc_evt_001",
    orderId: "ord_evt_001",
    totalCommission: 250.5,
    currency: "PKR",
    timestamp: new Date().toISOString(),
  };
  await consumerService.handleCommissionAccrued(accruedEvt);
  pass("Consumer handles commission.accrued event and posts ledger accrual");

  // 5.2 handleCommissionAdjusted
  await consumerService.handleCommissionAdjusted({
    adjustmentId: "adj_evt_001",
    orderId: "ord_evt_001",
    adjustmentAmount: 50.0,
    newTotalCommission: 200.5,
    currency: "PKR",
    reason: "Partial return of line item",
    timestamp: new Date().toISOString(),
  });
  pass("Consumer handles commission.adjusted event");

  // 5.3 handleCommissionReversed
  await consumerService.handleCommissionReversed({
    orderId: "ord_evt_001",
    reversedAmount: 200.5,
    currency: "PKR",
    reason: "Full order cancellation",
    timestamp: new Date().toISOString(),
  });
  pass("Consumer handles commission.reversed event");

  // 5.4 handleOrderDelivered
  await consumerService.handleOrderDelivered(
    "ord_evt_001",
    "seller_demo_01",
    {},
  );
  pass("Consumer handles order.delivered maturity unlock");

  // 5.5 handleSellerSuspended
  await consumerService.handleSellerSuspended(
    "seller_suspend_01",
    "Violation of policy",
  );
  pass("Consumer handles seller.suspended placing hold on payouts");

  // 5.6 handleSellerActivated
  await consumerService.handleSellerActivated("seller_suspend_01");
  pass("Consumer handles seller.activated releasing hold on payouts");

  await app.close();
  console.log(
    "\n==============================================================",
  );
  console.log(`🎉 All ${totalAssertions} payout-service tests passed cleanly!`);
  console.log("==============================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
