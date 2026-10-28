import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import {
  calculateItemPrice,
  calculateQuote,
  evaluateBestRule,
} from "../src/engine/calculator.js";
import { convertCurrency } from "../src/engine/currency.js";
import type { PriceRule } from "@repo/types";

async function runTests() {
  console.log("==================================================");
  console.log("     PRICING SERVICE TEST SUITE RUNNER");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: Decimal.js Financial Arithmetic & Negative Price Prevention
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Decimal.js Financial Calculation Engine");

  // Base price without rules
  const baseItem = calculateItemPrice("100.00", 2, null, "prod_1", null);
  assert.equal(baseItem.unitBasePrice, 100);
  assert.equal(baseItem.unitFinalPrice, 100);
  assert.equal(baseItem.unitDiscount, 0);
  assert.equal(baseItem.lineTotal, 200);
  console.log("  ✓ Base price without rules calculated accurately");

  // Percentage volume tier (10% off for 5+ items)
  const percentRule: PriceRule = {
    id: "rule_pct",
    priceListId: "pl_1",
    ruleType: "tier",
    productId: "prod_1",
    minQuantity: 5,
    discountType: "percentage",
    discountValue: 10,
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tierItem = calculateItemPrice("100.00", 5, percentRule, "prod_1", null);
  assert.equal(tierItem.unitBasePrice, 100);
  assert.equal(tierItem.unitDiscount, 10);
  assert.equal(tierItem.unitFinalPrice, 90);
  assert.equal(tierItem.lineTotal, 450);
  console.log("  ✓ Percentage tier discount calculated accurately");

  // Fixed amount discount with potential negative price prevention
  const fixedRuleExcessive: PriceRule = {
    id: "rule_fixed",
    priceListId: "pl_1",
    ruleType: "bulk",
    minQuantity: 1,
    discountType: "fixed_amount",
    discountValue: 150, // Greater than base price $100
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const clampedItem = calculateItemPrice(
    "100.00",
    1,
    fixedRuleExcessive,
    "prod_1",
    null,
  );
  assert.equal(clampedItem.unitFinalPrice, 0, "Price must be clamped to 0");
  assert.equal(
    clampedItem.unitDiscount,
    100,
    "Discount cannot exceed base price",
  );
  assert.equal(clampedItem.lineTotal, 0);
  console.log(
    "  ✓ Negative pricing successfully prevented and clamped to zero",
  );

  // Negative quantity check
  assert.throws(
    () => calculateItemPrice("100.00", 0, null, "prod_1"),
    /Quantity must be greater than zero/,
    "Zero quantity must throw",
  );
  console.log("  ✓ Invalid quantity rejected");

  // ────────────────────────────────────────────────────────────
  // Test 2: Quote Composition & Promotion Discount Deduction
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Quote Composition & Promotion Deductions");

  const quoteResult = calculateQuote({
    items: [
      {
        productId: "prod_1",
        quantity: 2,
        basePrice: "50.00",
        rules: [],
      },
      {
        productId: "prod_2",
        quantity: 5,
        basePrice: "20.00",
        rules: [
          {
            id: "rule_bulk_p2",
            priceListId: "pl_1",
            ruleType: "bulk",
            minQuantity: 5,
            discountType: "percentage",
            discountValue: 20, // 20% off $20 = $4 off ($16 unit price)
            priority: 1,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ],
    promotionDiscount: "15.00", // $15 promotional coupon quote
    currency: "USD",
  });

  // Prod 1: 2 * 50 = $100
  // Prod 2: 5 * 20 = $100 base, with 20% off = 5 * 16 = $80 ($20 discount)
  // Subtotal = $200
  // Rule discounts = $20
  // Promo discount = $15
  // Final total = 200 - 20 - 15 = $165.00
  assert.equal(quoteResult.subtotal, 200);
  assert.equal(quoteResult.totalDiscount, 20);
  assert.equal(quoteResult.promotionDiscount, 15);
  assert.equal(quoteResult.finalTotal, 165);
  console.log(
    "  ✓ Multi-item quote with volume tiers & promotion deduction composed correctly",
  );

  // ────────────────────────────────────────────────────────────
  // Test 3: Multi-Currency Converter
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] High-Precision Currency Conversion");

  const convSame = convertCurrency(100, 1.0, "USD", "USD");
  assert.equal(convSame.convertedAmount, 100);

  const convEur = convertCurrency(100, "0.925000", "USD", "EUR");
  assert.equal(convEur.convertedAmount, 92.5);
  assert.equal(convEur.targetCurrency, "EUR");

  assert.throws(
    () => convertCurrency(-50, 1.0, "USD", "EUR"),
    /must be non-negative/,
  );
  console.log(
    "  ✓ Currency conversions verified with zero floating-point drift",
  );

  // ────────────────────────────────────────────────────────────
  // Test 4: Fastify Server Endpoints & Security Hooks
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Fastify HTTP Endpoints & Auth Hooks");

  const app = await buildApp();

  // Health endpoint
  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok([200, 503].includes(healthRes.statusCode));
  const healthJson = JSON.parse(healthRes.payload);
  assert.equal(healthJson.service, "pricing-service");
  console.log("  ✓ /health endpoint verified");

  // Metrics endpoint
  const metricsRes = await app.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200);
  console.log("  ✓ /metrics endpoint verified");

  // Admin route without credentials (must return 403 Forbidden)
  const unauthAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/price-lists",
    payload: {
      name: "Secret List",
      code: "SEC_1",
    },
  });
  assert.equal(unauthAdminRes.statusCode, 403);
  console.log(
    "  ✓ Admin routes strictly protected against unauthorized access",
  );

  // Admin route with valid internal service secret header
  const authAdminRes = await app.inject({
    method: "POST",
    url: "/api/v1/admin/price-lists",
    headers: {
      "x-internal-secret": "dev-shared-internal-secret-larekmart",
    },
    payload: {
      name: "Wholesale Tier 1",
      code: "WHOLESALE_T1",
      currency: "USD",
      type: "b2b",
    },
  });
  // Should either succeed (201) or if DB unavailable return 400/500, but NOT 403
  assert.notEqual(authAdminRes.statusCode, 403);
  console.log("  ✓ Internal service secret correctly authenticates requests");

  // Public quote with invalid payload (must return 400 Bad Request)
  const invalidQuoteRes = await app.inject({
    method: "POST",
    url: "/api/v1/prices/quote",
    payload: {
      items: [], // Validation error: min 1 item
    },
  });
  assert.equal(invalidQuoteRes.statusCode, 400);
  const errJson = JSON.parse(invalidQuoteRes.payload);
  assert.ok(errJson.errors || errJson.message);
  console.log("  ✓ Request validation strictly enforced on quote endpoint");

  await app.close();

  // ────────────────────────────────────────────────────────────
  // Test 5: Date Validity & Rule Priority Hierarchy
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Rule Evaluation & Time-Window Constraints");

  const pastDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
  const yesterday = new Date(Date.now() - 86400000);
  const futureDate = new Date(Date.now() + 86400000 * 2); // 2 days in future

  const expiredRule: PriceRule = {
    id: "rule_expired",
    priceListId: "pl_1",
    ruleType: "tier",
    minQuantity: 1,
    discountType: "percentage",
    discountValue: 50,
    validFrom: pastDate,
    validTo: yesterday, // Expired yesterday
    priority: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const futureRule: PriceRule = {
    id: "rule_future",
    priceListId: "pl_1",
    ruleType: "tier",
    minQuantity: 1,
    discountType: "percentage",
    discountValue: 40,
    validFrom: futureDate,
    priority: 9,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeTier1: PriceRule = {
    id: "rule_t1",
    priceListId: "pl_1",
    ruleType: "tier",
    minQuantity: 5,
    maxQuantity: 9,
    discountType: "percentage",
    discountValue: 10,
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeTier2: PriceRule = {
    id: "rule_t2",
    priceListId: "pl_1",
    ruleType: "tier",
    minQuantity: 10,
    discountType: "percentage",
    discountValue: 20,
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const rules = [expiredRule, futureRule, activeTier1, activeTier2];

  // At qty 2 -> no matching active rule
  assert.equal(evaluateBestRule(2, rules), null);
  console.log("  ✓ Expired & future rules are strictly disregarded");

  // At qty 7 -> activeTier1 matches
  const match7 = evaluateBestRule(7, rules);
  assert.equal(match7?.id, "rule_t1");
  console.log("  ✓ Lower tier rule selected for intermediate volume");

  // At qty 12 -> activeTier2 matches (higher discount & higher minQuantity)
  const match12 = evaluateBestRule(12, rules);
  assert.equal(match12?.id, "rule_t2");
  console.log("  ✓ Upper tier rule selected for larger volume");

  // ────────────────────────────────────────────────────────────
  // Test 6: Override Price Rule Computation
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 6] Override Price Rule Engine");

  const overrideRule: PriceRule = {
    id: "rule_override",
    priceListId: "pl_1",
    ruleType: "tier",
    minQuantity: 3,
    discountType: "override_price",
    discountValue: 75, // Flat $75 instead of base $100
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const overrideItem = calculateItemPrice(
    "100.00",
    3,
    overrideRule,
    "prod_1",
    null,
  );
  assert.equal(overrideItem.unitBasePrice, 100);
  assert.equal(overrideItem.unitFinalPrice, 75);
  assert.equal(overrideItem.unitDiscount, 25);
  assert.equal(overrideItem.lineTotal, 225);
  console.log("  ✓ Override price rule calculated accurately");

  console.log("\n==================================================");
  console.log("  ALL PRICING-SERVICE TESTS PASSED SUCCESSFULLY!  ");
  console.log("==================================================\n");
}

runTests()
  .then(async () => {
    const { redis } = await import("../src/utils/redis.js");
    await redis.close().catch(() => {});
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
