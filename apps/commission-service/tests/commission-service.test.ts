import assert from "node:assert/strict";
import {
  CommissionCalculator,
  type ResolvableCommissionRule,
} from "../src/engine/commission-calculator.js";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";

async function runTests() {
  console.log("=== commission-service Test Suite ===");

  // Mock Ruleset
  const mockRules: ResolvableCommissionRule[] = [
    {
      id: "rule_global_8pct",
      planId: "plan_01",
      ruleType: "PERCENTAGE",
      scope: "GLOBAL",
      percentageRate: "8.00",
      fixedAmount: "0.00",
      minCommission: "10.00",
      maxCommission: "5000.00",
      priority: 0,
      status: "ACTIVE",
    },
    {
      id: "rule_electronics_5pct",
      planId: "plan_01",
      ruleType: "PERCENTAGE",
      scope: "CATEGORY",
      scopeId: "cat_electronics",
      percentageRate: "5.00",
      fixedAmount: "50.00",
      minCommission: "50.00",
      priority: 10,
      status: "ACTIVE",
    },
    {
      id: "rule_seller_vip_4pct",
      planId: "plan_01",
      ruleType: "PERCENTAGE",
      scope: "SELLER",
      scopeId: "seller_vip_99",
      percentageRate: "4.00",
      fixedAmount: "0.00",
      priority: 20,
      status: "ACTIVE",
    },
    {
      id: "rule_product_special_15pct",
      planId: "plan_01",
      ruleType: "PERCENTAGE",
      scope: "PRODUCT",
      scopeId: "prod_luxury_01",
      percentageRate: "15.00",
      fixedAmount: "100.00",
      priority: 30,
      status: "ACTIVE",
    },
  ];

  // 1. Hierarchy Resolution Tests
  console.log("1. Testing rule precedence hierarchy...");
  {
    // Product match overrides all
    const rule1 = CommissionCalculator.resolveBestRule(
      {
        orderItemId: "item_01",
        productId: "prod_luxury_01",
        categoryId: "cat_electronics",
        sellerId: "seller_vip_99",
        itemPrice: 1000,
        quantity: 1,
      },
      mockRules,
    );
    assert.equal(rule1.id, "rule_product_special_15pct");

    // Seller match overrides category & global
    const rule2 = CommissionCalculator.resolveBestRule(
      {
        orderItemId: "item_02",
        productId: "prod_regular_02",
        categoryId: "cat_electronics",
        sellerId: "seller_vip_99",
        itemPrice: 1000,
        quantity: 1,
      },
      mockRules,
    );
    assert.equal(rule2.id, "rule_seller_vip_4pct");

    // Category match overrides global
    const rule3 = CommissionCalculator.resolveBestRule(
      {
        orderItemId: "item_03",
        productId: "prod_tv_03",
        categoryId: "cat_electronics",
        sellerId: "seller_regular_01",
        itemPrice: 1000,
        quantity: 1,
      },
      mockRules,
    );
    assert.equal(rule3.id, "rule_electronics_5pct");

    // Global fallback
    const rule4 = CommissionCalculator.resolveBestRule(
      {
        orderItemId: "item_04",
        productId: "prod_book_04",
        categoryId: "cat_books",
        sellerId: "seller_regular_01",
        itemPrice: 1000,
        quantity: 1,
      },
      mockRules,
    );
    assert.equal(rule4.id, "rule_global_8pct");
    console.log("  ✓ Hierarchy resolved correctly (PRODUCT > SELLER > CATEGORY > GLOBAL)");
  }

  // 2. High-Precision Math & Min/Max Clamping
  console.log("2. Testing Decimal.js calculations & min/max clamping...");
  {
    // Minimum fee clamp: 8% on 50 PKR = 4 PKR, but min is 10 PKR
    const lineItemMin = CommissionCalculator.calculateLineItem(
      {
        orderItemId: "item_min",
        productId: "prod_cheap",
        categoryId: "cat_misc",
        sellerId: "seller_01",
        itemPrice: 50,
        quantity: 1,
      },
      mockRules[0]!,
    );
    assert.equal(lineItemMin.feeCalculated, 10.0);
    assert.equal(lineItemMin.minMaxApplied, true);

    // Normal calculation: 8% on 1000 PKR = 80 PKR
    const lineItemNormal = CommissionCalculator.calculateLineItem(
      {
        orderItemId: "item_norm",
        productId: "prod_normal",
        categoryId: "cat_misc",
        sellerId: "seller_01",
        itemPrice: 1000,
        quantity: 1,
      },
      mockRules[0]!,
    );
    assert.equal(lineItemNormal.feeCalculated, 80.0);
    assert.equal(lineItemNormal.minMaxApplied, false);

    // Maximum fee clamp: 8% on 100,000 PKR = 8,000 PKR, but max is 5,000 PKR
    const lineItemMax = CommissionCalculator.calculateLineItem(
      {
        orderItemId: "item_max",
        productId: "prod_expensive",
        categoryId: "cat_misc",
        sellerId: "seller_01",
        itemPrice: 100000,
        quantity: 1,
      },
      mockRules[0]!,
    );
    assert.equal(lineItemMax.feeCalculated, 5000.0);
    assert.equal(lineItemMax.minMaxApplied, true);
    console.log("  ✓ Decimal precision and min/max limits verified");
  }

  // 3. Multi-Seller Order Calculation Grouping
  console.log("3. Testing multi-seller order commission grouping...");
  {
    const orderItems = [
      {
        orderItemId: "item_s1_01",
        productId: "p1",
        categoryId: "cat_books",
        sellerId: "seller_A",
        itemPrice: 500,
        quantity: 2, // 1000 subtotal -> 8% = 80 fee
      },
      {
        orderItemId: "item_s2_01",
        productId: "p2",
        categoryId: "cat_electronics",
        sellerId: "seller_B",
        itemPrice: 2000,
        quantity: 1, // 2000 subtotal -> 5% + 50 = 150 fee
      },
    ];

    const calcs = CommissionCalculator.calculateOrderCommissions(
      "ord_multi_99",
      orderItems,
      mockRules,
      "PKR",
    );

    assert.equal(calcs.length, 2);

    const calcA = calcs.find((c) => c.sellerId === "seller_A")!;
    assert.equal(calcA.subtotal, 1000.0);
    assert.equal(calcA.totalCommission, 80.0);
    assert.equal(calcA.netSellerPayout, 920.0);

    const calcB = calcs.find((c) => c.sellerId === "seller_B")!;
    assert.equal(calcB.subtotal, 2000.0);
    assert.equal(calcB.totalCommission, 150.0);
    assert.equal(calcB.netSellerPayout, 1850.0);

    console.log("  ✓ Multi-seller order calculations isolated and balanced");
  }

  // 4. HTTP Endpoint Testing via Fastify Inject
  console.log("4. Testing HTTP routes and auth gates...");
  const app = buildApp();
  await app.ready();

  {
    // Health check
    const res = await app.inject({
      method: "GET",
      url: "/metrics",
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.service, "commission-service");
  }

  {
    // Internal quote endpoint without secret -> 401
    const unauth = await app.inject({
      method: "POST",
      url: "/api/v1/internal/commissions/quote",
      payload: { items: [] },
    });
    assert.equal(unauth.statusCode, 401);

    // Internal quote endpoint with secret -> 200
    const quoteRes = await app.inject({
      method: "POST",
      url: "/api/v1/internal/commissions/quote",
      headers: {
        "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
      },
      payload: {
        currency: "PKR",
        items: [
          {
            orderItemId: "item_api_01",
            productId: "prod_01",
            categoryId: "cat_misc",
            sellerId: "seller_test",
            itemPrice: 500,
            quantity: 1,
          },
        ],
      },
    });

    assert.equal(quoteRes.statusCode, 200);
    const quote = JSON.parse(quoteRes.body);
    assert.equal(quote.currency, "PKR");
    assert.ok(quote.totalCommission >= 0);
  }

  {
    // Admin plans endpoint without admin role -> 403
    const adminUnauth = await app.inject({
      method: "GET",
      url: "/api/v1/admin/commissions/plans",
      headers: {
        "x-user-role": "customer",
      },
    });
    assert.equal(adminUnauth.statusCode, 403);

    // Admin plans with admin header -> passes auth gate (not 403)
    const adminAuth = await app.inject({
      method: "GET",
      url: "/api/v1/admin/commissions/plans",
      headers: {
        "x-user-role": "admin",
      },
    });
    assert.notEqual(adminAuth.statusCode, 403);
    assert.ok([200, 500].includes(adminAuth.statusCode));
  }

  await app.close();
  console.log("  ✓ All HTTP endpoints and auth gates verified");

  console.log("==========================================");
  console.log("🎉 All commission-service tests passed cleanly!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
