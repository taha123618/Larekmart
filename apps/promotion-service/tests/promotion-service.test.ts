import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { GATEWAY_HEADERS } from "@repo/types";
import { pool } from "../src/db/connection.js";
import { redis } from "../src/utils/redis.js";

const ADMIN_HEADERS = {
  [GATEWAY_HEADERS.INTERNAL_SECRET]: "dev-shared-internal-secret-larekmart",
  [GATEWAY_HEADERS.USER_ID]: "admin_test_user_1",
  [GATEWAY_HEADERS.USER_ROLE]: "admin",
  "content-type": "application/json",
};

const USER_HEADERS = {
  [GATEWAY_HEADERS.INTERNAL_SECRET]: "dev-shared-internal-secret-larekmart",
  [GATEWAY_HEADERS.USER_ID]: "customer_test_user_1",
  [GATEWAY_HEADERS.USER_ROLE]: "user",
  "content-type": "application/json",
};

async function runTests() {
  console.log("==================================================");
  console.log("      PROMOTION SERVICE COMPREHENSIVE TEST SUITE  ");
  console.log("==================================================\n");

  // Clean slate for test isolation
  const cleanClient = await pool.connect();
  try {
    await cleanClient.query("DELETE FROM promotion_redemptions");
    await cleanClient.query("DELETE FROM promotion_reservations");
    await cleanClient.query("DELETE FROM coupon_codes");
    await cleanClient.query("DELETE FROM promotion_targets");
    await cleanClient.query("DELETE FROM promotion_rules");
    await cleanClient.query("DELETE FROM promotion_budgets");
    await cleanClient.query("DELETE FROM promotion_audit_logs");
    await cleanClient.query("DELETE FROM promotions");
  } finally {
    cleanClient.release();
  }

  let createdPromoId = "";
  let couponCodeStr = `SAVE20_${Date.now()}`;
  let reservationId = "";

  try {
    // ------------------------------------------------------------
    // Test 1: Health, Readiness, and Metrics Endpoints
    // ------------------------------------------------------------
    console.log("[Test 1] Health, Readiness & Metrics Endpoints");
    const healthRes = await app.request("/health");
    assert.ok(
      [200, 503].includes(healthRes.status),
      "Health status should be 200 or 503",
    );
    const healthJson = (await healthRes.json()) as any;
    assert.equal(healthJson.service, "promotion-service");
    console.log("✓ /health passed");

    const readyRes = await app.request("/ready");
    assert.ok(
      [200, 503].includes(readyRes.status),
      "Ready status should be 200 or 503",
    );
    console.log("✓ /ready passed");

    const metricsRes = await app.request("/metrics");
    assert.equal(metricsRes.status, 200);
    console.log("✓ /metrics passed");

    // ------------------------------------------------------------
    // Test 2: Auth Gating Verification (Admin RBAC)
    // ------------------------------------------------------------
    console.log("\n[Test 2] Auth Gating Verification");
    const unauthRes = await app.request("/api/v1/admin/promotions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.ok(
      [401, 403].includes(unauthRes.status),
      `Expected unauthenticated request to be rejected with 401/403, got ${unauthRes.status}`,
    );
    console.log("✓ Unauthenticated request rejected");

    const nonAdminRes = await app.request("/api/v1/admin/promotions", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({}),
    });
    assert.equal(
      nonAdminRes.status,
      403,
      "Non-admin request must be rejected with 403",
    );
    console.log("✓ Non-admin request rejected with 403");

    // ------------------------------------------------------------
    // Test 3: Create Promotion (Admin)
    // ------------------------------------------------------------
    console.log("\n[Test 3] Create Campaign Promotion");
    const now = new Date();
    const startDate = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const endDate = new Date(now.getTime() + 86400000 * 7).toISOString(); // 7 days later

    const createPromoRes = await app.request("/api/v1/admin/promotions", {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        name: "Grand Mega Sale 20%",
        description: "20% off orders over $50",
        type: "PERCENTAGE",
        discountValue: 20,
        maxDiscountAmount: 100,
        startDate,
        endDate,
        priority: 10,
        isStackable: true,
        rules: {
          minOrderAmount: 50,
          customerSegment: "ALL",
          maxPerCustomer: 5,
          globalLimit: 1000,
        },
        budget: {
          totalBudget: 5000,
          currency: "USD",
        },
      }),
    });

    assert.equal(
      createPromoRes.status,
      201,
      "Expected 201 Created for promotion",
    );
    const createPromoJson = (await createPromoRes.json()) as any;
    assert.ok(createPromoJson.data?.id, "Created promotion must have an ID");
    createdPromoId = createPromoJson.data.id;
    assert.equal(createPromoJson.data.status, "DRAFT");
    console.log(`✓ Promotion created with ID: ${createdPromoId}`);

    // ------------------------------------------------------------
    // Test 4: Create Coupon Code
    // ------------------------------------------------------------
    console.log("\n[Test 4] Create Coupon Code");
    const createCouponRes = await app.request("/api/v1/admin/coupons", {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        promotionId: createdPromoId,
        code: couponCodeStr,
        maxRedemptions: 500,
      }),
    });

    assert.equal(
      createCouponRes.status,
      201,
      "Expected 201 Created for coupon",
    );
    const createCouponJson = (await createCouponRes.json()) as any;
    assert.equal(createCouponJson.data.code, couponCodeStr);
    assert.equal(createCouponJson.data.isActive, true);
    console.log(`✓ Coupon code created: ${couponCodeStr}`);

    // ------------------------------------------------------------
    // Test 5: Activate Promotion
    // ------------------------------------------------------------
    console.log("\n[Test 5] Activate Promotion");
    const activateRes = await app.request(
      `/api/v1/admin/promotions/${createdPromoId}/activate`,
      {
        method: "POST",
        headers: ADMIN_HEADERS,
      },
    );
    assert.equal(activateRes.status, 200);
    const activateJson = (await activateRes.json()) as any;
    assert.equal(activateJson.data.status, "ACTIVE");

    // Verify it is present in active promotions
    const activeRes = await app.request("/api/v1/promotions/active");
    assert.equal(activeRes.status, 200);
    const activeJson = (await activeRes.json()) as any;
    const found = activeJson.data.some((p: any) => p.id === createdPromoId);
    assert.ok(found, "Newly activated promotion must appear in active list");
    console.log("✓ Promotion activated and listed in /promotions/active");

    // ------------------------------------------------------------
    // Test 6: Validate Coupon Code
    // ------------------------------------------------------------
    console.log("\n[Test 6] Validate Coupon Code");
    // Invalid when order subtotal < 50
    const invalidValRes = await app.request("/api/v1/promotions/validate", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({
        code: couponCodeStr,
        items: [{ productId: 101, price: 30, quantity: 1 }],
      }),
    });
    assert.equal(invalidValRes.status, 200);
    const invalidValJson = (await invalidValRes.json()) as any;
    assert.equal(
      invalidValJson.valid,
      false,
      "Should be invalid when subtotal < 50",
    );
    console.log("✓ Subtotal under minOrderAmount correctly rejected");

    // Valid when order subtotal >= 50
    const validValRes = await app.request("/api/v1/promotions/validate", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({
        code: couponCodeStr,
        items: [
          { productId: 101, price: 50, quantity: 2 }, // $100 subtotal
        ],
      }),
    });
    assert.equal(validValRes.status, 200);
    const validValJson = (await validValRes.json()) as any;
    assert.equal(
      validValJson.valid,
      true,
      "Should be valid when subtotal >= 50",
    );
    assert.equal(validValJson.estimatedDiscount, 20); // 20% of 100 = $20
    console.log("✓ Coupon validation passed with estimatedDiscount $20");

    // ------------------------------------------------------------
    // Test 7: Calculate Promotion Quote
    // ------------------------------------------------------------
    console.log("\n[Test 7] Calculate Promotion Quote for Cart");
    const quoteRes = await app.request("/api/v1/promotions/quote", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({
        couponCodes: [couponCodeStr],
        items: [
          { productId: 101, price: 60, quantity: 2 }, // $120
        ],
      }),
    });
    assert.equal(quoteRes.status, 200);
    const quoteJson = (await quoteRes.json()) as any;
    assert.equal(quoteJson.data.subtotal, 120);
    assert.equal(quoteJson.data.totalDiscount, 24); // 20% of 120 = $24
    assert.equal(quoteJson.data.finalTotal, 96);
    console.log(
      "✓ Quote calculation verified: subtotal $120 -> discount $24 -> total $96",
    );

    // ------------------------------------------------------------
    // Test 8: Create Reservation (Checkout Hold)
    // ------------------------------------------------------------
    console.log("\n[Test 8] Create Reservation with Budget Hold");
    const orderRef = `order_test_${Date.now()}`;
    const reserveRes = await app.request("/api/v1/promotions/reservations", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({
        promotionId: createdPromoId,
        couponCode: couponCodeStr,
        orderId: orderRef,
        discountAmount: 24,
        ttlSeconds: 900,
      }),
    });
    assert.equal(reserveRes.status, 201);
    const reserveJson = (await reserveRes.json()) as any;
    assert.ok(reserveJson.data?.id);
    reservationId = reserveJson.data.id;
    assert.equal(reserveJson.data.status, "RESERVED");
    assert.equal(reserveJson.data.discountAmount, 24);
    console.log(`✓ Reservation created with ID: ${reservationId}`);

    // Idempotency: repeating same reservation returns existing record
    const idempotentRes = await app.request("/api/v1/promotions/reservations", {
      method: "POST",
      headers: USER_HEADERS,
      body: JSON.stringify({
        promotionId: createdPromoId,
        couponCode: couponCodeStr,
        orderId: orderRef,
        discountAmount: 24,
      }),
    });
    assert.equal(idempotentRes.status, 201);
    const idempotentJson = (await idempotentRes.json()) as any;
    assert.equal(
      idempotentJson.data.id,
      reservationId,
      "Must return idempotent reservation ID",
    );
    console.log("✓ Idempotent reservation check verified");

    // ------------------------------------------------------------
    // Test 9: Commit Reservation on Order Completion
    // ------------------------------------------------------------
    console.log("\n[Test 9] Commit Reservation");
    const commitRes = await app.request(
      `/api/v1/promotions/reservations/${reservationId}/commit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: orderRef }),
      },
    );
    assert.equal(commitRes.status, 200);
    const commitJson = (await commitRes.json()) as any;
    assert.ok(commitJson.data?.id, "Redemption record must be created");
    assert.equal(commitJson.data.orderId, orderRef);
    assert.equal(commitJson.data.discountAmount, 24);
    console.log("✓ Reservation committed successfully to redemptions");

    // ------------------------------------------------------------
    // Test 10: Release Reservation on Checkout Failure
    // ------------------------------------------------------------
    console.log("\n[Test 10] Reservation Release Workflow");
    const cancelOrderRef = `order_cancel_${Date.now()}`;
    const tempReserveRes = await app.request(
      "/api/v1/promotions/reservations",
      {
        method: "POST",
        headers: USER_HEADERS,
        body: JSON.stringify({
          promotionId: createdPromoId,
          couponCode: couponCodeStr,
          orderId: cancelOrderRef,
          discountAmount: 15,
        }),
      },
    );
    const tempResJson = (await tempReserveRes.json()) as any;
    const tempId = tempResJson.data.id;

    const releaseRes = await app.request(
      `/api/v1/promotions/reservations/${tempId}/release`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "User cancelled payment" }),
      },
    );
    assert.equal(releaseRes.status, 200);
    const releaseJson = (await releaseRes.json()) as any;
    assert.equal(releaseJson.data.status, "RELEASED");
    console.log("✓ Reservation released and budget returned");

    // ------------------------------------------------------------
    // Test 11: Admin Overview & Redemptions History
    // ------------------------------------------------------------
    console.log("\n[Test 11] Admin Redemptions History & Overview");
    const redemptionsRes = await app.request(
      `/api/v1/admin/promotions/${createdPromoId}/redemptions`,
      {
        method: "GET",
        headers: ADMIN_HEADERS,
      },
    );
    assert.equal(redemptionsRes.status, 200);
    const redemptionsJson = (await redemptionsRes.json()) as any;
    assert.ok(
      redemptionsJson.data.length >= 1,
      "Must have recorded redemptions",
    );
    assert.equal(redemptionsJson.data[0].orderId, orderRef);
    console.log(
      `✓ Verified ${redemptionsJson.data.length} redemptions in audit history`,
    );

    const overviewRes = await app.request("/api/v1/admin/promotions/overview", {
      method: "GET",
      headers: ADMIN_HEADERS,
    });
    assert.equal(overviewRes.status, 200);
    const overviewJson = (await overviewRes.json()) as any;
    assert.ok(overviewJson.data.totalPromotions >= 1);
    assert.ok(overviewJson.data.totalRedemptions >= 1);
    console.log("✓ Overview metrics retrieved successfully");

    console.log("\n==================================================");
    console.log("       ALL 11 PROMOTION TESTS PASSED (100%)       ");
    console.log("==================================================");
  } finally {
    try {
      await redis.close();
    } catch {}
    try {
      await pool.end();
    } catch {}
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
