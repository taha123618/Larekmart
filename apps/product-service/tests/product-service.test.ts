import assert from "node:assert/strict";
import {
  shouldBeUser,
  shouldBeAdmin,
  shouldBeSellerOrAdmin,
} from "../src/middleware/authMiddleware.js";
import { toProductEventPayload } from "../src/search/product-payload.js";
import { ProductFormSchema, GATEWAY_HEADERS } from "@repo/types";
import type { Product } from "@repo/product-db";

function createMockResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

async function runProductServiceTests() {
  console.log("==================================================");
  console.log("📦 product-service SQA Unit & Integration Test Suite");
  console.log("==================================================\n");

  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = "test-product-internal-secret-12345";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: shouldBeUser Authentication Guard
    // -------------------------------------------------------------------------
    console.log("1. Testing shouldBeUser authentication guard...");

    // 1A. Unauthenticated without headers or Clerk token -> 401
    const unauthReq = {
      headers: {},
      auth: () => ({ userId: null, sessionClaims: null }),
    } as any;
    const unauthRes = createMockResponse();
    let nextCalled = false;

    shouldBeUser(unauthReq, unauthRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      unauthRes.statusCode,
      401,
      "Unauthenticated request must return 401",
    );
    assert.deepEqual(unauthRes.body, { message: "You are not logged in!" });
    assert.equal(
      nextCalled,
      false,
      "next() must not be called when unauthenticated",
    );
    console.log("  ✓ Unauthenticated request rejected with 401");

    // 1B. Authenticated via Clerk token
    nextCalled = false;
    const clerkUserReq = {
      headers: {},
      auth: () => ({
        tokenType: "session_token",
        userId: "user_clerk_123",
        sessionClaims: { metadata: { role: "user" } },
      }),
    } as any;
    const clerkUserRes = createMockResponse();

    shouldBeUser(clerkUserReq, clerkUserRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Clerk token user must invoke next()");
    assert.equal(clerkUserReq.userId, "user_clerk_123");
    console.log("  ✓ Clerk token user authenticated successfully");

    // 1C. Gateway trusted header propagation
    nextCalled = false;
    const gatewayReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-product-internal-secret-12345",
        [GATEWAY_HEADERS.USER_ID]: "user_product_caller_999",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const gatewayRes = createMockResponse();

    shouldBeUser(gatewayReq, gatewayRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Valid gateway headers must invoke next()");
    assert.equal(
      gatewayReq.userId,
      "user_product_caller_999",
      "req.userId must be populated",
    );
    assert.equal(gatewayReq.userRole, "user", "req.userRole must be populated");
    console.log("  ✓ Trusted API Gateway header propagation authenticated");

    // -------------------------------------------------------------------------
    // TEST 2: shouldBeAdmin Authorization Guard
    // -------------------------------------------------------------------------
    console.log("\n2. Testing shouldBeAdmin authorization guard...");

    // 2A. Non-admin role via gateway -> 403 Forbidden
    nextCalled = false;
    const nonAdminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-product-internal-secret-12345",
        [GATEWAY_HEADERS.USER_ID]: "user_regular_456",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const nonAdminRes = createMockResponse();

    shouldBeAdmin(nonAdminReq, nonAdminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      nonAdminRes.statusCode,
      403,
      "Non-admin must receive 403 Forbidden",
    );
    assert.deepEqual(nonAdminRes.body, { message: "Unauthorized!" });
    assert.equal(nextCalled, false, "next() must not be called for non-admin");
    console.log("  ✓ Non-admin request rejected with 403 Forbidden");

    // 2B. Admin role via gateway -> Allowed
    nextCalled = false;
    const adminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-product-internal-secret-12345",
        [GATEWAY_HEADERS.USER_ID]: "user_admin_001",
        [GATEWAY_HEADERS.USER_ROLE]: "admin",
      },
    } as any;
    const adminRes = createMockResponse();

    shouldBeAdmin(adminReq, adminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Admin request must invoke next()");
    assert.equal(adminReq.userId, "user_admin_001");
    assert.equal(adminReq.userRole, "admin");
    console.log("  ✓ Admin request authorized successfully");

    // -------------------------------------------------------------------------
    // TEST 3: shouldBeSellerOrAdmin Authorization Guard
    // -------------------------------------------------------------------------
    console.log("\n3. Testing shouldBeSellerOrAdmin authorization guard...");

    // 3A. Seller role via gateway -> Allowed
    nextCalled = false;
    const sellerReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-product-internal-secret-12345",
        [GATEWAY_HEADERS.USER_ID]: "user_merchant_777",
        [GATEWAY_HEADERS.USER_ROLE]: "seller",
      },
    } as any;
    const sellerRes = createMockResponse();

    shouldBeSellerOrAdmin(sellerReq, sellerRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Seller role must invoke next()");
    assert.equal(sellerReq.userId, "user_merchant_777");
    assert.equal(sellerReq.userRole, "seller");
    console.log("  ✓ Seller role authorized successfully");

    // 3B. Regular user -> 403
    nextCalled = false;
    const regUserReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-product-internal-secret-12345",
        [GATEWAY_HEADERS.USER_ID]: "user_customer_111",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const regUserRes = createMockResponse();

    shouldBeSellerOrAdmin(regUserReq, regUserRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      regUserRes.statusCode,
      403,
      "Regular user must receive 403 in seller route",
    );
    assert.deepEqual(regUserRes.body, {
      message: "Seller or Admin role required!",
    });
    assert.equal(nextCalled, false);
    console.log("  ✓ Non-seller/non-admin rejected with 403 Forbidden");

    // -------------------------------------------------------------------------
    // TEST 4: Product Event Payload Serialization (toProductEventPayload)
    // -------------------------------------------------------------------------
    console.log(
      "\n4. Testing toProductEventPayload serialization invariants...",
    );

    const mockProduct: Product & { sellerId?: string; sellerName?: string } = {
      id: 42,
      name: "Aerodynamic Running Shoes",
      shortDescription: "Ultra-lightweight mesh shoes for marathon runners",
      description:
        "Detailed description with breathability specs and EVA foam cushioning.",
      price: 129.99 as any,
      categorySlug: "footwear",
      sizes: ["8", "9", "10", "11"],
      colors: ["Midnight Blue", "Crimson Red"],
      images: {
        front: "https://assets.larekmart.com/shoes/front.webp",
        angle: "https://assets.larekmart.com/shoes/angle.webp",
      } as any,
      sellerId: "seller_run_tech_corp",
      sellerName: "RunTech Official Store",
      createdAt: new Date("2026-10-25T10:00:00.000Z"),
      updatedAt: new Date("2026-10-25T12:00:00.000Z"),
    };

    const payload = toProductEventPayload(mockProduct);

    assert.equal(payload.id, "42", "Product ID must be converted to string");
    assert.equal(payload.name, "Aerodynamic Running Shoes");
    assert.equal(payload.categorySlug, "footwear");
    assert.deepEqual(payload.sizes, ["8", "9", "10", "11"]);
    assert.deepEqual(payload.colors, ["Midnight Blue", "Crimson Red"]);
    assert.equal(
      payload.sellerId,
      "seller_run_tech_corp",
      "Seller ID must be mapped",
    );
    assert.equal(
      payload.sellerName,
      "RunTech Official Store",
      "Seller Name must be mapped",
    );
    assert.equal(
      payload.createdAt,
      "2026-10-25T10:00:00.000Z",
      "createdAt must be ISO string",
    );
    assert.equal(
      payload.updatedAt,
      "2026-10-25T12:00:00.000Z",
      "updatedAt must be ISO string",
    );
    console.log(
      "  ✓ toProductEventPayload mapped all fields with exact type assertions",
    );

    // -------------------------------------------------------------------------
    // TEST 5: Product Validation Schema (ProductFormSchema)
    // -------------------------------------------------------------------------
    console.log("\n5. Testing ProductFormSchema validation...");

    const validProductData = {
      name: "Smart Hydration Bottle",
      shortDescription: "Tracks water intake with Bluetooth LED ring",
      description:
        "Vacuum insulated 750ml stainless steel bottle with hydration telemetry.",
      price: 49.99,
      categorySlug: "fitness-accessories",
      sizes: ["m", "l"] as any,
      colors: ["blue", "black"] as any,
      images: {
        blue: "https://assets.larekmart.com/bottle/blue.webp",
        black: "https://assets.larekmart.com/bottle/black.webp",
      },
      sellerId: "seller_hydration_co",
    };

    const validParsed = ProductFormSchema.safeParse(validProductData);
    assert.equal(
      validParsed.success,
      true,
      "Valid product form must parse cleanly",
    );
    console.log("  ✓ Valid ProductFormSchema parsed successfully");

    const invalidProductData = {
      name: "T", // Too short (min 2)
      price: -10, // Negative price invalid
      categorySlug: "", // Required slug
    };

    const invalidParsed = ProductFormSchema.safeParse(invalidProductData);
    assert.equal(
      invalidParsed.success,
      false,
      "Invalid product form must be rejected",
    );
    console.log(
      "  ✓ Invalid ProductFormSchema rejected with validation errors",
    );

    console.log("\n==================================================");
    console.log("🎉 ALL PRODUCT SERVICE SQA TESTS PASSED (100%)");
    console.log("==================================================");
  } finally {
    process.env.INTERNAL_SERVICE_SECRET = originalSecret;
  }
}

runProductServiceTests().catch((err) => {
  console.error("❌ Product service tests failed:", err);
  process.exit(1);
});
