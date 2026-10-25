import assert from "node:assert/strict";
import { Hono } from "hono";
import {
  shouldBeUser,
  shouldBeAdmin,
  type AuthVariables,
} from "../src/middleware/authMiddleware.js";
import { availabilityFromItems } from "../src/cache/inventory-cache.js";
import {
  GATEWAY_HEADERS,
  InventoryAdjustmentSchema,
  InventoryReservationSchema,
  InventoryRestockSchema,
} from "@repo/types";
import type { InventoryItem } from "@repo/inventory-db";

async function runInventoryServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("📦 inventory-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = "test-inventory-secret-123";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: shouldBeUser Authentication Guard
    // -------------------------------------------------------------------------
    console.log("\n1. Testing shouldBeUser authentication guard...");
    const userApp = new Hono<{
      Variables: AuthVariables & { clerkAuth?: any };
    }>();
    userApp.use("*", async (c, next) => {
      c.set("clerkAuth", () => ({ userId: null }));
      await next();
    });
    userApp.use("*", shouldBeUser);
    userApp.get("/protected-stock", (c) => {
      return c.json({ userId: c.get("userId"), role: c.get("userRole") });
    });

    // 1A. No credentials -> 401
    const unauthRes = await userApp.request("/protected-stock");
    assert.equal(
      unauthRes.status,
      401,
      "Unauthenticated request must return 401",
    );
    const unauthBody = (await unauthRes.json()) as { message?: string };
    assert.equal(unauthBody.message, "You are not logged in.");
    console.log("  ✓ Unauthenticated user request rejected with 401");

    // 1B. Gateway propagation -> 200
    const gatewayRes = await userApp.request("/protected-stock", {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-inventory-secret-123",
        [GATEWAY_HEADERS.USER_ID]: "user_inventory_shopper_01",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    });
    assert.equal(gatewayRes.status, 200, "Gateway propagation must succeed");
    const gatewayBody = (await gatewayRes.json()) as {
      userId: string;
      role?: string;
    };
    assert.equal(gatewayBody.userId, "user_inventory_shopper_01");
    console.log("  ✓ Internal gateway header propagation sets user context");

    // -------------------------------------------------------------------------
    // TEST 2: shouldBeAdmin Authorization Guard
    // -------------------------------------------------------------------------
    console.log("\n2. Testing shouldBeAdmin authorization guard...");
    const adminApp = new Hono<{
      Variables: AuthVariables & { clerkAuth?: any };
    }>();
    adminApp.use("*", async (c, next) => {
      c.set("clerkAuth", () => ({ userId: null }));
      await next();
    });
    adminApp.use("*", shouldBeAdmin);
    adminApp.get("/protected-admin-stock", (c) => {
      return c.json({ userId: c.get("userId"), role: c.get("userRole") });
    });

    // 2A. Gateway Non-Admin -> 403 Forbidden
    const nonAdminRes = await adminApp.request("/protected-admin-stock", {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-inventory-secret-123",
        [GATEWAY_HEADERS.USER_ID]: "user_regular_customer",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    });
    assert.equal(nonAdminRes.status, 403, "Non-admin must return 403");
    const nonAdminBody = (await nonAdminRes.json()) as { message?: string };
    assert.equal(nonAdminBody.message, "Unauthorized!");
    console.log("  ✓ Non-admin request rejected with 403 Unauthorized");

    // 2B. Gateway Admin -> 200 OK
    const adminRes = await adminApp.request("/protected-admin-stock", {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-inventory-secret-123",
        [GATEWAY_HEADERS.USER_ID]: "admin_warehouse_mgr_99",
        [GATEWAY_HEADERS.USER_ROLE]: "admin",
      },
    });
    assert.equal(adminRes.status, 200, "Admin must succeed");
    const adminBody = (await adminRes.json()) as {
      userId: string;
      role?: string;
    };
    assert.equal(adminBody.userId, "admin_warehouse_mgr_99");
    assert.equal(adminBody.role, "admin");
    console.log("  ✓ Admin authorized successfully");

    // -------------------------------------------------------------------------
    // TEST 3: Domain Schemas Validation
    // -------------------------------------------------------------------------
    console.log("\n3. Testing Inventory Zod schemas validation...");

    // 3A. InventoryReservationSchema
    const validReservation = {
      productId: 42,
      variantId: "var_blue_m",
      warehouseId: "wh_central_pk",
      quantity: 2,
      referenceType: "ORDER",
      referenceId: "cart_res_checkout_12345",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    const parsedReservation =
      InventoryReservationSchema.safeParse(validReservation);
    assert.equal(
      parsedReservation.success,
      true,
      "Valid reservation must parse",
    );
    console.log("  ✓ InventoryReservationSchema parsed reservation parameters");

    // 3B. InventoryAdjustmentSchema
    const validAdjustment = {
      productId: 42,
      variantId: "var_blue_m",
      warehouseId: "wh_central_pk",
      quantityDelta: -5,
      movementType: "DAMAGE",
      reason: "Water damage in bay 4",
      referenceType: "AUDIT",
      referenceId: "audit_incident_789",
    };
    const parsedAdjustment =
      InventoryAdjustmentSchema.safeParse(validAdjustment);
    assert.equal(parsedAdjustment.success, true, "Valid adjustment must parse");
    console.log(
      "  ✓ InventoryAdjustmentSchema validated stock delta parameters",
    );

    // 3C. InventoryRestockSchema
    const validRestock = {
      productId: 42,
      variantId: "var_blue_m",
      warehouseId: "wh_central_pk",
      quantity: 100,
      reason: "Quarterly stock replenishment",
      referenceType: "PO",
      referenceId: "po_supplier_9876",
    };
    const parsedRestock = InventoryRestockSchema.safeParse(validRestock);
    assert.equal(parsedRestock.success, true, "Valid restock must parse");
    console.log(
      "  ✓ InventoryRestockSchema verified warehouse restock payload",
    );

    // -------------------------------------------------------------------------
    // TEST 4: availabilityFromItems Cache Calculation
    // -------------------------------------------------------------------------
    console.log("\n4. Testing availabilityFromItems aggregation logic...");

    const mockItems: InventoryItem[] = [
      {
        id: "item_1",
        productId: 42,
        variantId: "blue_m",
        sku: "SHOE-BLU-M",
        warehouseId: "wh_lahore",
        availableQuantity: 25,
        reservedQuantity: 5,
        soldQuantity: 10,
        safetyStock: 5,
        status: "ACTIVE" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "item_2",
        productId: 42,
        variantId: "blue_m",
        sku: "SHOE-BLU-M",
        warehouseId: "wh_karachi",
        availableQuantity: 30,
        reservedQuantity: 2,
        soldQuantity: 15,
        safetyStock: 5,
        status: "ACTIVE" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const availability = availabilityFromItems(42, mockItems, "blue_m");
    assert.equal(availability.productId, 42);
    assert.equal(
      availability.availableQuantity,
      55,
      "Total available quantity must sum to 55",
    );
    assert.equal(
      availability.warehouses.length,
      2,
      "Must aggregate 2 warehouse entries",
    );
    console.log(
      "  ✓ availabilityFromItems correctly aggregated multi-warehouse stock",
    );

    console.log("\n==================================================");
    console.log("🎉 ALL INVENTORY SERVICE SQA TESTS PASSED (100%)");
    console.log("==================================================");
  } finally {
    process.env.INTERNAL_SERVICE_SECRET = originalSecret;
  }
}

runInventoryServiceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Inventory service tests failed:", err);
    process.exit(1);
  });
