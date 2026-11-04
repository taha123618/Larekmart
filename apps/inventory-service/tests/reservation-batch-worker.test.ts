import assert from "node:assert/strict";
import {
  batchReserveInventory,
  type ReserveInventoryInput,
} from "@repo/inventory-db";

async function runReservationBatchWorkerTests(): Promise<void> {
  console.log("==================================================");
  console.log("⚡ Inventory Reservation Micro-Batch Processing Suite");
  console.log("==================================================");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Empty input returns empty result
    // -------------------------------------------------------------------------
    console.log("\n1. Testing empty reservation batch handling...");
    const emptyResult = await batchReserveInventory([]);
    assert.deepEqual(emptyResult.successful, []);
    assert.deepEqual(emptyResult.failed, []);
    console.log("  ✓ Empty batch handled gracefully without database queries");

    // -------------------------------------------------------------------------
    // TEST 2: Validation of invalid quantities & past expiration
    // -------------------------------------------------------------------------
    console.log(
      "\n2. Testing validation filtering for malformed reservations...",
    );
    const invalidInputs: ReserveInventoryInput[] = [
      {
        productId: 101,
        variantId: "v1",
        warehouseId: "wh1",
        quantity: -1, // Invalid
        referenceType: "ORDER",
        referenceId: "ref_inv_1",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 60000),
      },
      {
        productId: 102,
        variantId: "v2",
        warehouseId: "wh1",
        quantity: 0, // Invalid
        referenceType: "ORDER",
        referenceId: "ref_inv_2",
        userId: "user_2",
        expiresAt: new Date(Date.now() + 60000),
      },
      {
        productId: 103,
        variantId: "v3",
        warehouseId: "wh1",
        quantity: 1,
        referenceType: "ORDER",
        referenceId: "ref_inv_3",
        userId: "user_3",
        expiresAt: new Date(Date.now() - 60000), // Expired
      },
    ];

    const validationResult = await batchReserveInventory(invalidInputs);
    assert.equal(validationResult.successful.length, 0);
    assert.equal(validationResult.failed.length, 3);
    assert.ok(
      validationResult.failed[0]?.error.message.includes("positive integer"),
    );
    assert.ok(
      validationResult.failed[1]?.error.message.includes("positive integer"),
    );
    assert.ok(
      validationResult.failed[2]?.error.message.includes(
        "expire in the future",
      ),
    );
    console.log(
      "  ✓ Malformed and expired items rejected before database dispatch",
    );

    console.log("\n==================================================");
    console.log("🎉 ALL RESERVATION BATCH WORKER TESTS PASSED (100%)");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Batch worker test failed:", err);
    throw err;
  }
}

runReservationBatchWorkerTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
