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

    // Non-qualified user (isSeller !== true) rejected with 403 SELLER_NOT_AUTHORIZED
    const nonQualifiedRes = await app.inject({
      method: "POST",
      url: "/api/v1/sellers",
      headers: {
        "x-user-id": "usr-regular-customer",
        "x-user-role": "customer",
      },
      payload: {
        vendorId: "vnd-test-1",
        storeName: "Test Store",
        slug: "test-store",
      },
    });
    assert.equal(nonQualifiedRes.statusCode, 403);
    const nonQualJson = JSON.parse(nonQualifiedRes.payload);
    assert.equal(nonQualJson.code, "SELLER_NOT_AUTHORIZED");
    console.log(
      "  ✓ Unqualified user rejected from POST /api/v1/sellers with 403 SELLER_NOT_AUTHORIZED",
    );

    // Validation error: invalid slug format and missing vendorId when qualified
    const invalidCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/sellers",
      headers: {
        "x-user-id": "usr-12345",
        "x-user-is-seller": "true",
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

    // ────────────────────────────────────────────────────────────
    // Test 5: Super Admin System Controls & Feature Toggling
    // ────────────────────────────────────────────────────────────
    console.log("\n[Test 5] Super Admin Governance & Feature Toggling");

    // 5.1 Public system settings endpoint
    const pubSettingsRes = await app.inject({
      method: "GET",
      url: "/api/v1/system-settings",
    });
    assert.equal(pubSettingsRes.statusCode, 200);
    const pubSettings = JSON.parse(pubSettingsRes.payload);
    assert.equal(pubSettings.id, "marketplace");
    assert.equal(typeof pubSettings.isSellerEnabled, "boolean");
    console.log(
      "  ✓ Public GET /api/v1/system-settings returns marketplace settings",
    );

    // 5.2 Admin read system settings
    const adminReadSettingsRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/system-settings",
      headers: {
        "x-user-id": "admin-1",
        "x-user-role": "admin",
      },
    });
    assert.equal(adminReadSettingsRes.statusCode, 200);
    console.log(
      "  ✓ Admin GET /api/v1/admin/system-settings succeeds with admin role",
    );

    // 5.3 Unauthorized admin cannot mutate system settings
    const unauthorizedAdminPatchRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/system-settings",
      headers: {
        "x-user-id": "regular-admin-1",
        "x-user-role": "admin",
        // Notice: lacks x-user-is-super-admin or role !== super_admin
      },
      payload: {
        isSellerEnabled: false,
      },
    });
    assert.equal(unauthorizedAdminPatchRes.statusCode, 403);
    const unauthBody = JSON.parse(unauthorizedAdminPatchRes.payload);
    assert.equal(unauthBody.code, "SUPER_ADMIN_REQUIRED");
    console.log(
      "  ✓ Regular admin strictly forbidden from mutating system settings (403 SUPER_ADMIN_REQUIRED)",
    );

    // 5.4 Super Admin toggles isSellerEnabled to false
    const superAdminDisableRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/system-settings",
      headers: {
        "x-user-id": "super-admin-root",
        "x-user-role": "admin",
        "x-user-is-super-admin": "true",
      },
      payload: {
        isSellerEnabled: false,
      },
    });
    assert.equal(superAdminDisableRes.statusCode, 200);
    const disabledResult = JSON.parse(superAdminDisableRes.payload);
    assert.equal(disabledResult.settings.isSellerEnabled, false);
    console.log(
      "  ✓ Super Admin successfully disabled seller feature (isSellerEnabled: false)",
    );

    // 5.5 When disabled: seller creation blocked with 403 SELLER_FEATURE_DISABLED
    const blockedCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/sellers",
      headers: {
        "x-user-id": "usr-qualified-seller",
        "x-user-is-seller": "true",
      },
      payload: {
        vendorId: "vnd-test-1",
        storeName: "Blocked Store",
        slug: "blocked-store",
      },
    });
    assert.equal(blockedCreateRes.statusCode, 403);
    const blockedCreateJson = JSON.parse(blockedCreateRes.payload);
    assert.equal(blockedCreateJson.code, "SELLER_FEATURE_DISABLED");
    console.log(
      "  ✓ Seller creation blocked when feature disabled (403 SELLER_FEATURE_DISABLED)",
    );

    // 5.6 When disabled: public storefront lookup blocked with 403 SELLER_FEATURE_DISABLED
    const blockedStorefrontRes = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts/any-store-slug",
    });
    assert.equal(blockedStorefrontRes.statusCode, 403);
    const blockedStorefrontJson = JSON.parse(blockedStorefrontRes.payload);
    assert.equal(blockedStorefrontJson.code, "SELLER_FEATURE_DISABLED");
    console.log(
      "  ✓ Public storefront routes blocked when feature disabled (403 SELLER_FEATURE_DISABLED)",
    );

    // 5.7 Super Admin re-enables seller functionality
    const superAdminReEnableRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/system-settings",
      headers: {
        "x-user-id": "super-admin-root",
        "x-user-role": "super_admin",
      },
      payload: {
        isSellerEnabled: true,
      },
    });
    assert.equal(superAdminReEnableRes.statusCode, 200);
    const reEnabledResult = JSON.parse(superAdminReEnableRes.payload);
    assert.equal(reEnabledResult.settings.isSellerEnabled, true);
    console.log(
      "  ✓ Super Admin successfully re-enabled seller feature (isSellerEnabled: true)",
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
