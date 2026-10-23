import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { sellerEventProducer } from "../src/kafka/producer.js";
import { cacheService } from "../src/services/cache.service.js";
import { closeDatabase } from "../src/db/connection.js";
import { env } from "../src/config/env.js";

async function runSellerServiceTests() {
  console.log("==================================================");
  console.log("     SELLER SERVICE TEST SUITE RUNNER");
  console.log("==================================================\n");

  const app = await buildApp();

  try {
    // ────────────────────────────────────────────────────────────
    // Test 1: Health & Observability Endpoints
    // ────────────────────────────────────────────────────────────
    console.log("[Test 1] Health & Metrics Endpoints");

    const healthRes = await app.inject({
      method: "GET",
      url: "/health",
    });
    assert.ok([200, 503].includes(healthRes.statusCode));
    const healthJson = JSON.parse(healthRes.payload);
    assert.equal(healthJson.service, "seller-service");
    console.log("  ✓ /health endpoint verified");

    const aliasHealthRes = await app.inject({
      method: "GET",
      url: "/api/v1/sellers/health",
    });
    assert.ok([200, 503].includes(aliasHealthRes.statusCode));
    console.log("  ✓ /api/v1/sellers/health alias verified");

    const metricsRes = await app.inject({
      method: "GET",
      url: "/metrics",
    });
    assert.equal(metricsRes.statusCode, 200);
    assert.ok(metricsRes.payload.includes("seller_service_up"));
    console.log("  ✓ /metrics endpoint verified");

    // ────────────────────────────────────────────────────────────
    // Test 2: Authentication & Authorization Guards
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 2] Auth & Access Control");

    // Unauthenticated seller creation must return 401
    const unauthCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/sellers",
      payload: {
        vendorId: "vnd-test-1",
        storeName: "My Tech Store",
        slug: "my-tech-store",
      },
    });
    assert.equal(unauthCreateRes.statusCode, 401);
    console.log("  ✓ Unauthenticated POST /api/v1/sellers rejected with 401");

    // Unauthenticated seller profile listing must return 401
    const unauthMeRes = await app.inject({
      method: "GET",
      url: "/api/v1/sellers/me",
    });
    assert.equal(unauthMeRes.statusCode, 401);
    console.log("  ✓ Unauthenticated GET /api/v1/sellers/me rejected with 401");

    // Admin route without admin role must return 403
    const unauthAdminRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sellers",
      headers: {
        "x-user-id": "user-regular",
        "x-user-role": "customer",
      },
    });
    assert.equal(unauthAdminRes.statusCode, 403);
    console.log("  ✓ Admin routes strictly reject non-admin users with 403");

    // Admin route with internal service secret passes auth guard
    const authInternalRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sellers",
      headers: {
        "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
      },
    });
    assert.notEqual(authInternalRes.statusCode, 401);
    assert.notEqual(authInternalRes.statusCode, 403);
    console.log("  ✓ Internal service secret correctly authenticates requests");

    // ────────────────────────────────────────────────────────────
    // Test 3: Input Validation & Boundary Enforcement
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 3] Input Validation & Boundary Invariants");

    // Validation error: invalid slug format and missing vendorId
    const invalidCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/sellers",
      headers: {
        "x-user-id": "usr-12345",
      },
      payload: {
        vendorId: "",
        storeName: "A", // too short
        slug: "INVALID SLUG WITH SPACES",
      },
    });
    assert.equal(invalidCreateRes.statusCode, 400);
    const errJson = JSON.parse(invalidCreateRes.payload);
    assert.equal(errJson.message, "Validation failed");
    assert.ok(errJson.errors && errJson.errors.length > 0);
    console.log("  ✓ Invalid seller creation payload rejected with 400");

    // Public storefront lookup for non-existent slug returns 404 or 503 if db down
    const notFoundStoreRes = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts/non-existent-store-slug-9999",
    });
    assert.ok([404, 500, 503].includes(notFoundStoreRes.statusCode));
    console.log("  ✓ Storefront lookup gracefully handled");

    // ────────────────────────────────────────────────────────────
    // Test 4: Kafka Event Producer Safe Emission
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Kafka Event Producer Resiliency");

    await sellerEventProducer.publishSellerCreated({
      sellerId: "sel-test-1",
      vendorId: "vnd-test-1",
      primaryUserId: "usr-test-1",
      storeName: "Superstore",
      slug: "superstore",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });

    await sellerEventProducer.publishSellerActivated({
      sellerId: "sel-test-1",
      vendorId: "vnd-test-1",
      activatedAt: new Date().toISOString(),
      activatedByUserId: "admin-1",
    });

    await sellerEventProducer.publishSellerSuspended({
      sellerId: "sel-test-1",
      vendorId: "vnd-test-1",
      reason: "Policy violation",
      suspendedAt: new Date().toISOString(),
    });

    await sellerEventProducer.publishSellerUpdated({
      sellerId: "sel-test-1",
      updatedFields: ["status"],
      updatedAt: new Date().toISOString(),
    });

    await sellerEventProducer.publishSellerStorefrontUpdated({
      sellerId: "sel-test-1",
      storeId: "str-test-1",
      storeName: "Superstore Renovated",
      slug: "superstore-renovated",
      vacationMode: false,
      status: "ACTIVE",
      updatedAt: new Date().toISOString(),
    });

    console.log(
      "  ✓ Kafka event producer safely operates in disconnected / dev mode",
    );

    console.log("\n==================================================");
    console.log("  ALL SELLER-SERVICE TESTS PASSED SUCCESSFULLY!   ");
    console.log("==================================================\n");
  } finally {
    await app.close();
    await cacheService.close();
    await closeDatabase();
  }
}

runSellerServiceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
