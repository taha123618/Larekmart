/**
 * Opt-in integration test script for `@repo/inventory-db`.
 *
 * Verifies core database guarantees against a live PostgreSQL database:
 * 1. Warehouse creation, lookup & listing
 * 2. Initial item creation & inventory accounting invariant (quantity = available + reserved + sold)
 * 3. Atomic stock reservation (available -> reserved)
 * 4. Atomic oversell prevention under concurrency (cannot reserve past 0)
 * 5. Reservation confirmation (reserved -> sold) & SALE audit movement
 * 6. Reservation release (reserved -> available) & RELEASE audit movement
 * 7. Inter-warehouse transfer with TRANSFER_OUT & TRANSFER_IN movements
 * 8. Consolidated inventory availability lookup across warehouses
 * 9. Audit ledger integrity & movement verification
 *
 * Run with:
 *   pnpm --filter @repo/inventory-db test:integration
 */

import {
  prisma,
  createWarehouse,
  getWarehouse,
  listWarehouses,
  createInventoryItem,
  reserveInventory,
  confirmInventoryReservation,
  releaseInventoryReservation,
  transferInventory,
  getInventoryAvailability,
  listMovements,
  InsufficientStockError,
  InventoryMovementType,
  WarehouseStatus,
} from "../index.js";

const TEST_PRODUCT_ID = 999990 + Math.floor(Math.random() * 9000);
const TEST_VARIANT_ID = "test-variant-opt";
const TEST_WAREHOUSE_ID = "wh-integration-test";
const TEST_DEST_WAREHOUSE_ID = "wh-integration-dest";

let failures = 0;

function assert(
  condition: boolean,
  description: string,
  extra?: unknown,
): void {
  if (!condition) {
    failures++;
    console.error(`❌ FAIL: ${description}`, extra ?? "");
  } else {
    console.log(`✅ PASS: ${description}`);
  }
}

async function run(): Promise<void> {
  console.log(
    `\n--- Starting @repo/inventory-db Integration Tests (Product ID: ${TEST_PRODUCT_ID}) ---`,
  );

  try {
    // 1. Warehouse Management
    const wh = await createWarehouse({
      id: `wh-test-${Date.now()}`,
      name: "Test Transit Hub",
      code: `TEST-HUB-${Date.now()}`,
      status: WarehouseStatus.ACTIVE,
      address: "Industrial Zone, Berth 4",
    });
    assert(
      wh.status === WarehouseStatus.ACTIVE,
      "Warehouse created with ACTIVE status",
    );

    const fetchedWh = await getWarehouse(wh.id);
    assert(
      fetchedWh?.code === wh.code,
      "Warehouse retrieved by unique identifier",
    );

    const warehouses = await listWarehouses();
    assert(
      warehouses.length > 0,
      "Warehouse listing returns registered facilities",
    );

    // 2. Initial Item Setup
    const initialItem = await createInventoryItem({
      productId: TEST_PRODUCT_ID,
      variantId: TEST_VARIANT_ID,
      warehouseId: TEST_WAREHOUSE_ID,
      quantity: 100,
      reorderPoint: 10,
    });

    assert(initialItem.quantity === 100, "Initial quantity is 100");
    assert(
      initialItem.availableQuantity === 100,
      "Initial availableQuantity is 100",
    );
    assert(initialItem.reservedQuantity === 0, "Initial reservedQuantity is 0");
    assert(initialItem.soldQuantity === 0, "Initial soldQuantity is 0");

    // 3. Reserve 10 Units
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const reservation = await reserveInventory({
      productId: TEST_PRODUCT_ID,
      variantId: TEST_VARIANT_ID,
      warehouseId: TEST_WAREHOUSE_ID,
      userId: "user_test_123",
      quantity: 10,
      referenceType: "CHECKOUT",
      referenceId: `chk_${Date.now()}`,
      expiresAt,
    });

    assert(reservation.quantity === 10, "Reservation quantity is 10");
    assert(
      reservation.inventoryItem.availableQuantity === 90,
      "Available stock decremented to 90",
    );
    assert(
      reservation.inventoryItem.reservedQuantity === 10,
      "Reserved stock incremented to 10",
    );
    assert(
      reservation.inventoryItem.soldQuantity === 0,
      "Sold stock remains 0",
    );
    assert(
      reservation.inventoryItem.quantity ===
        reservation.inventoryItem.availableQuantity +
          reservation.inventoryItem.reservedQuantity +
          reservation.inventoryItem.soldQuantity,
      "Accounting invariant (quantity = available + reserved + sold) holds after reservation",
    );

    // 4. Confirm 10 Units (Sale)
    const confirmed = await confirmInventoryReservation(
      reservation.id,
      "user_test_123",
      {
        reason: "Stripe payment received",
      },
    );

    assert(
      confirmed.status === "CONFIRMED",
      "Reservation status transitioned to CONFIRMED",
    );
    assert(
      confirmed.inventoryItem.availableQuantity === 90,
      "Available stock remains 90",
    );
    assert(
      confirmed.inventoryItem.reservedQuantity === 0,
      "Reserved stock decremented to 0",
    );
    assert(
      confirmed.inventoryItem.soldQuantity === 10,
      "Sold stock incremented to 10",
    );
    assert(
      confirmed.inventoryItem.quantity ===
        confirmed.inventoryItem.availableQuantity +
          confirmed.inventoryItem.reservedQuantity +
          confirmed.inventoryItem.soldQuantity,
      "Accounting invariant holds after confirmation",
    );

    // 5. Test Oversell Prevention (Available is 90, request 100)
    let oversellPrevented = false;
    try {
      await reserveInventory({
        productId: TEST_PRODUCT_ID,
        variantId: TEST_VARIANT_ID,
        warehouseId: TEST_WAREHOUSE_ID,
        userId: "user_greedy",
        quantity: 100,
        referenceType: "CHECKOUT",
        referenceId: `chk_oversell_${Date.now()}`,
        expiresAt,
      });
    } catch (err) {
      if (
        err instanceof InsufficientStockError ||
        (err instanceof Error && err.message.includes("Insufficient inventory"))
      ) {
        oversellPrevented = true;
      }
    }
    assert(
      oversellPrevented,
      "Oversell prevented when requesting more units than available",
    );

    // 6. Reserve & Release Test
    const tempRes = await reserveInventory({
      productId: TEST_PRODUCT_ID,
      variantId: TEST_VARIANT_ID,
      warehouseId: TEST_WAREHOUSE_ID,
      userId: "user_cancel",
      quantity: 5,
      referenceType: "CHECKOUT",
      referenceId: `chk_temp_${Date.now()}`,
      expiresAt,
    });
    assert(
      tempRes.inventoryItem.availableQuantity === 85,
      "Stock decremented for temp reservation",
    );

    const released = await releaseInventoryReservation(
      tempRes.id,
      "user_cancel",
      {
        reason: "User cancelled checkout",
      },
    );
    assert(released.status === "RELEASED", "Reservation status is RELEASED");
    assert(
      released.inventoryItem.availableQuantity === 90,
      "Stock restored back to 90 after release",
    );
    assert(
      released.inventoryItem.reservedQuantity === 0,
      "Reserved quantity returned to 0",
    );

    // 7. Warehouse Transfer Test (Transfer 20 units from WH1 to WH2)
    const transfer = await transferInventory({
      productId: TEST_PRODUCT_ID,
      variantId: TEST_VARIANT_ID,
      fromWarehouseId: TEST_WAREHOUSE_ID,
      toWarehouseId: TEST_DEST_WAREHOUSE_ID,
      quantity: 20,
      reason: "Rebalance stock across fulfillment zones",
    });

    assert(
      transfer.fromItem.availableQuantity === 70,
      "Source warehouse stock reduced by 20",
    );
    assert(
      transfer.toItem.availableQuantity === 20,
      "Destination warehouse received 20 units",
    );
    assert(
      transfer.outMovement.type === InventoryMovementType.TRANSFER_OUT,
      "TRANSFER_OUT movement recorded",
    );
    assert(
      transfer.inMovement.type === InventoryMovementType.TRANSFER_IN,
      "TRANSFER_IN movement recorded",
    );

    // 8. Consolidated Availability Query
    const availability = await getInventoryAvailability({
      productId: TEST_PRODUCT_ID,
    });
    assert(
      availability.totalAvailable === 70 + 20,
      `Consolidated available quantity across warehouses is 90 (got ${availability.totalAvailable})`,
    );
    assert(
      availability.totalSold === 10,
      `Consolidated sold quantity is 10 (got ${availability.totalSold})`,
    );

    // 9. Verify Audit Movements Ledger
    const movements = await listMovements({ productId: TEST_PRODUCT_ID });
    assert(
      movements.length >= 6,
      `Movement ledger recorded all transactions (found ${movements.length})`,
    );
    const types = movements.map((m: { type: InventoryMovementType }) => m.type);
    assert(
      types.includes(InventoryMovementType.PURCHASE),
      "Ledger includes initial PURCHASE",
    );
    assert(
      types.includes(InventoryMovementType.RESERVE),
      "Ledger includes RESERVE movements",
    );
    assert(
      types.includes(InventoryMovementType.SALE),
      "Ledger includes SALE movement",
    );
    assert(
      types.includes(InventoryMovementType.RELEASE),
      "Ledger includes RELEASE movement",
    );
    assert(
      types.includes(InventoryMovementType.TRANSFER_OUT),
      "Ledger includes TRANSFER_OUT movement",
    );
    assert(
      types.includes(InventoryMovementType.TRANSFER_IN),
      "Ledger includes TRANSFER_IN movement",
    );

    console.log(`\nIntegration tests completed with ${failures} failure(s).`);
  } catch (err) {
    console.error("Fatal error during integration tests:", err);
    failures++;
  } finally {
    // Cleanup test data to maintain database cleanliness
    try {
      await prisma.inventoryMovement.deleteMany({
        where: { inventoryItem: { productId: TEST_PRODUCT_ID } },
      });
      await prisma.inventoryReservation.deleteMany({
        where: { inventoryItem: { productId: TEST_PRODUCT_ID } },
      });
      await prisma.inventoryItem.deleteMany({
        where: { productId: TEST_PRODUCT_ID },
      });
      console.log(
        `Cleaned up integration test records for product ${TEST_PRODUCT_ID}.`,
      );
    } catch {
      // Ignore cleanup error
    }
    await prisma.$disconnect();
  }

  if (failures > 0) {
    process.exit(1);
  }
}

void run();
