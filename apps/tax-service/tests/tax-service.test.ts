import assert from "assert";
import Decimal from "decimal.js";
import { TaxCalculator } from "../src/services/calculator.js";
import { TaxProviderFactory } from "../src/adapters/provider-factory.js";
import {
  safeTimingCompare,
  isInternalService,
} from "../src/middleware/auth.middleware.js";
import { buildServer } from "../src/server.js";
import { redis } from "../src/utils/redis.js";
import { closeDatabase } from "../src/db/connection.js";
import type { TaxQuoteRequest, TaxCalculationResponse } from "@repo/types";
import { handleOrderCreatedEvent } from "../src/events/consumers/order.consumer.js";
import {
  handleProductTaxCategoryUpdatedEvent,
  handleTaxRulesUpdatedEvent,
} from "../src/events/consumers/product.consumer.js";

async function runTaxServiceTestSuite() {
  console.log("=== Tax Service Comprehensive Test Suite ===\n");

  // --------------------------------------------------------------------------
  // Test 1: Decimal Precision & Exclusive Tax Arithmetic
  // --------------------------------------------------------------------------
  console.log("1. Testing Decimal Precision & Exclusive Tax Arithmetic...");
  const exclusiveQuoteReq: TaxQuoteRequest = {
    currency: "USD",
    destinationAddress: {
      country: "US",
      region: "CA",
      city: "Los Angeles",
      postalCode: "90001",
    },
    lines: [
      {
        lineId: "line_1",
        productId: "prod_shirt",
        categoryCode: "clothing",
        quantity: 2,
        unitPrice: "50.00",
        amount: "100.00",
        discountAmount: "10.00", // Net: 90.00
      },
    ],
    isInclusive: false,
  };

  const caRules = [
    {
      id: "rule_ca",
      jurisdictionCode: "US-CA",
      jurisdictionName: "California State Tax",
      jurisdictionType: "region" as const,
      categoryCode: "standard",
      rate: "0.060000", // 6%
      isInclusive: false,
      priority: 1,
      version: "2026-10",
    },
    {
      id: "rule_la",
      jurisdictionCode: "US-CA-LA",
      jurisdictionName: "Los Angeles County Tax",
      jurisdictionType: "municipality" as const,
      categoryCode: "standard",
      rate: "0.022500", // 2.25%
      isInclusive: false,
      priority: 2,
      version: "2026-10",
    },
  ];

  const calcResult = TaxCalculator.calculate(exclusiveQuoteReq, {
    calculationId: "tax_calc_unit_1",
    rules: caRules,
    ruleVersion: "2026-10",
  });

  // Net taxable: 90.00. Rate: 0.0825 (8.25%).
  // Tax: 90.00 * 0.0825 = 7.425 => ROUND_HALF_UP = 7.43.
  // Total: 90.00 + 7.43 = 97.43.
  assert.equal(calcResult.subtotal, "90.00", "Subtotal must be 90.00");
  assert.equal(
    calcResult.taxTotal,
    "7.43",
    "Tax total must be 7.43 (Half-Up rounding)",
  );
  assert.equal(
    calcResult.total,
    "97.43",
    "Total must be 97.43 (subtotal + taxTotal)",
  );
  assert.equal(
    calcResult.lines[0]?.breakdown.length,
    2,
    "Must contain 2 breakdown items",
  );

  const stateBreakdown = calcResult.lines[0]?.breakdown.find(
    (b) => b.jurisdictionCode === "US-CA",
  );
  assert.ok(stateBreakdown, "State breakdown exists");
  assert.equal(stateBreakdown?.rate, "0.060000");

  console.log("✓ Exclusive tax calculation and breakdown verified");

  // --------------------------------------------------------------------------
  // Test 2: Inclusive Tax Arithmetic (e.g. European / UK VAT)
  // --------------------------------------------------------------------------
  console.log("2. Testing Inclusive Tax Arithmetic (20% VAT)...");
  const inclusiveQuoteReq: TaxQuoteRequest = {
    currency: "GBP",
    destinationAddress: {
      country: "GB",
    },
    lines: [
      {
        lineId: "line_gb_1",
        productId: "prod_gadget",
        categoryCode: "standard",
        quantity: 1,
        unitPrice: "120.00",
        amount: "120.00",
        discountAmount: "0.00",
        isInclusive: true,
      },
    ],
    isInclusive: true,
  };

  const ukVatRules = [
    {
      id: "rule_uk_vat",
      jurisdictionCode: "GB",
      jurisdictionName: "UK HMRC VAT",
      jurisdictionType: "country" as const,
      categoryCode: "standard",
      rate: "0.200000", // 20%
      isInclusive: true,
      priority: 1,
      version: "2026-10",
    },
  ];

  const incResult = TaxCalculator.calculate(inclusiveQuoteReq, {
    calculationId: "tax_calc_unit_inc",
    rules: ukVatRules,
  });

  // Gross: 120.00. Rate: 20%. Net = 120 / 1.20 = 100.00. Tax = 20.00. Total = 120.00.
  assert.equal(
    incResult.subtotal,
    "100.00",
    "Inclusive taxable subtotal must be 100.00",
  );
  assert.equal(
    incResult.taxTotal,
    "20.00",
    "Inclusive tax total must be 20.00",
  );
  assert.equal(incResult.total, "120.00", "Inclusive total must be 120.00");
  console.log("✓ Inclusive tax arithmetic verified");

  // --------------------------------------------------------------------------
  // Test 3: Tax Exemptions Handling
  // --------------------------------------------------------------------------
  console.log("3. Testing Customer Tax Exemption Handling...");
  const exemptResult = TaxCalculator.calculate(exclusiveQuoteReq, {
    calculationId: "tax_calc_exempt",
    rules: caRules,
    isExempt: true,
    exemptionReason: "Wholesale resale exemption",
  });

  assert.equal(exemptResult.isExempt, true, "isExempt flag must be true");
  assert.equal(
    exemptResult.taxTotal,
    "0.00",
    "Tax total must be 0.00 for exempt order",
  );
  assert.equal(
    exemptResult.total,
    "90.00",
    "Total must equal subtotal for exempt order",
  );
  console.log("✓ Customer tax exemption verified");

  // --------------------------------------------------------------------------
  // Test 4: Returns & Refunds Proportional Tax Adjustment
  // --------------------------------------------------------------------------
  console.log("4. Testing Proportional Tax Refund Adjustment...");
  const originalSnapshot: TaxCalculationResponse = {
    calculationId: "tax_calc_orig_100",
    currency: "USD",
    subtotal: "100.00",
    taxTotal: "8.25",
    total: "108.25",
    ruleVersion: "2026-10",
    provider: "standard",
    isExempt: false,
    calculatedAt: new Date().toISOString(),
    lines: [
      {
        lineId: "line_1",
        taxableAmount: "100.00",
        taxAmount: "8.25",
        rate: "0.082500",
        jurisdictionCode: "US-CA",
        isInclusive: false,
        breakdown: [],
      },
    ],
  };

  const returnQuoteReq = {
    originalCalculationId: "tax_calc_orig_100",
    returnedLines: [
      {
        lineId: "line_1",
        quantity: 1,
        returnAmount: "50.00", // Returning 50% of the line
      },
    ],
  };

  const returnResult = TaxCalculator.calculateReturnQuote(
    returnQuoteReq,
    originalSnapshot,
  );
  // 50% refund -> 50.00 return amount, 8.25 * 0.50 = 4.125 => 4.13 tax refund. Total refund = 54.13
  assert.equal(returnResult.subtotalRefund, "50.00");
  assert.equal(returnResult.taxRefundTotal, "4.13");
  assert.equal(returnResult.totalRefund, "54.13");
  console.log("✓ Return and refund proportional tax adjustment verified");

  // --------------------------------------------------------------------------
  // Test 5: Tax Provider Adapter Pattern
  // --------------------------------------------------------------------------
  console.log("5. Testing Provider Adapter Pattern & Factory...");
  const standardAdapter = TaxProviderFactory.getProvider("standard");
  assert.equal(standardAdapter.getProviderName(), "standard");

  const externalAdapter = TaxProviderFactory.getProvider("external");
  assert.equal(externalAdapter.getProviderName(), "external-provider");

  const extQuote = await externalAdapter.calculateTax(exclusiveQuoteReq, {
    calculationId: "tax_ext_test",
    rules: caRules,
  });
  assert.equal(extQuote.provider, "external-provider");
  console.log("✓ Tax provider adapter pattern verified");

  // --------------------------------------------------------------------------
  // Test 6: Security & Timing-Safe Comparison
  // --------------------------------------------------------------------------
  console.log("6. Testing Timing-Safe Authentication & Secret Validation...");
  const validSecret = "dev-shared-internal-secret-larekmart";
  assert.equal(safeTimingCompare(validSecret, validSecret), true);
  assert.equal(safeTimingCompare(validSecret, "wrong-secret"), false);
  assert.equal(safeTimingCompare("", validSecret), false);

  const mockValidReq = {
    headers: { "x-internal-secret": validSecret },
  } as unknown as Parameters<typeof isInternalService>[0];
  assert.equal(isInternalService(mockValidReq), true);

  const mockInvalidReq = {
    headers: { "x-internal-secret": "invalid" },
  } as unknown as Parameters<typeof isInternalService>[0];
  assert.equal(isInternalService(mockInvalidReq), false);
  console.log("✓ Timing-safe auth comparisons verified");

  // --------------------------------------------------------------------------
  // Test 7: Fastify HTTP Server Integration via inject()
  // --------------------------------------------------------------------------
  console.log("7. Testing Fastify HTTP API Endpoints via injection...");
  const app = await buildServer();

  // A. Quote endpoint
  const quoteRes = await app.inject({
    method: "POST",
    url: "/api/v1/tax/quote",
    payload: exclusiveQuoteReq,
  });
  assert.equal(
    quoteRes.statusCode,
    200,
    "POST /api/v1/tax/quote should return 200",
  );
  const quoteJson = quoteRes.json();
  assert.equal(quoteJson.currency, "USD");
  assert.ok(quoteJson.calculationId);
  console.log("✓ POST /api/v1/tax/quote HTTP injection verified");

  // B. Validation rejection on malformed quote
  const badQuoteRes = await app.inject({
    method: "POST",
    url: "/api/v1/tax/quote",
    payload: { currency: "INVALID_LONG_CODE" },
  });
  assert.equal(badQuoteRes.statusCode, 400, "Invalid payload must return 400");
  console.log("✓ 400 Validation rejection verified");

  // C. Admin protection: without internal secret or admin role -> 403
  const unauthorizedAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/tax/rules",
    payload: {
      jurisdictionId: "jur_1",
      categoryId: "cat_1",
      rate: "0.05",
      effectiveFrom: new Date().toISOString(),
    },
  });
  assert.equal(
    unauthorizedAdminRes.statusCode,
    403,
    "Admin route without secret must return 403",
  );
  console.log("✓ Admin route protection verified");

  // D1. Zero-Trust Verification: Non-admin proxied user with gateway transport secret must be rejected (403)
  const proxiedUserAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/tax/rules",
    headers: {
      "x-internal-secret": validSecret,
      "x-user-role": "user",
      "x-user-id": "cust_123",
    },
    payload: {
      rate: "0.05",
    },
  });
  assert.equal(
    proxiedUserAdminRes.statusCode,
    403,
    "Non-admin user proxied via API Gateway must be rejected despite valid internal secret",
  );
  console.log(
    "✓ Zero-Trust verified: Non-admin proxied user rejected with 403",
  );

  // D2. Proxied admin user with gateway transport secret passes auth guard (reaches schema validator 400)
  const proxiedAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/tax/rules",
    headers: {
      "x-internal-secret": validSecret,
      "x-user-role": "admin",
      "x-user-id": "admin_123",
    },
    payload: {
      rate: "invalid_rate",
    },
  });
  assert.equal(
    proxiedAdminRes.statusCode,
    400,
    "Proxied admin passes auth guard and reaches schema validator (400)",
  );
  console.log("✓ Proxied admin route execution verified");

  // D3. Pure machine-to-machine internal service call: passes auth guard (reaches schema validator 400)
  const authAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/tax/rules",
    headers: {
      "x-internal-secret": validSecret,
    },
    payload: {
      // Missing required fields to trigger schema error (which proves auth passed!)
      rate: "invalid_rate",
    },
  });
  assert.equal(
    authAdminRes.statusCode,
    400,
    "With valid secret, request reaches schema validator (400)",
  );
  console.log(
    "✓ Pure machine-to-machine admin route authenticated execution verified",
  );

  // E. Health endpoint
  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok(
    healthRes.statusCode === 200 || healthRes.statusCode === 503,
    "Health endpoint returns structured status",
  );
  assert.equal(healthRes.json().service, "tax-service");
  console.log("✓ /health endpoint verified");

  // --------------------------------------------------------------------------
  // Test 8: Kafka Event Consumers Resiliency
  // --------------------------------------------------------------------------
  console.log("8. Testing Kafka Event Consumer Resiliency...");
  // Verify consumers don't throw on unexpected or corrupt payloads
  await handleOrderCreatedEvent(null);
  await handleOrderCreatedEvent({ orderId: "ord_test_123" });
  await handleProductTaxCategoryUpdatedEvent({
    productId: "p1",
    taxCategoryCode: "clothing",
  });
  await handleTaxRulesUpdatedEvent({ version: "2026-10", ruleIds: ["r1"] });
  console.log("✓ Kafka event consumer handlers executed safely");

  await app.close();
  await redis.close();
  await closeDatabase();

  console.log("\n=======================================================");
  console.log(" All Tax Service SQA Test Cases Passed Successfully!  ");
  console.log("=======================================================\n");
  process.exit(0);
}

runTaxServiceTestSuite().catch((err) => {
  console.error("Tax service test suite failed:", err);
  process.exit(1);
});
