import assert from "node:assert/strict";
import {
  createStockTransferRecord,
  listStockTransfers,
  recordCycleCount,
  upsertSafetyStockPolicy,
  getSafetyStockPolicy,
} from "../src/services/inventory-operations.service.js";

console.log("=== inventory-service Operations Unit Tests ===");

// 1. Stock transfers
const trf = createStockTransferRecord({
  productId: 101,
  variantId: "var_1",
  fromWarehouseId: "wh_khi",
  toWarehouseId: "wh_lhr",
  quantity: 25,
  reason: "Rebalance Lahore hub",
});
assert.equal(trf.status, "COMPLETED");
assert.equal(listStockTransfers().length, 1);

assert.throws(() =>
  createStockTransferRecord({
    productId: 101,
    variantId: "var_1",
    fromWarehouseId: "wh_khi",
    toWarehouseId: "wh_khi",
    quantity: 10,
  }),
);
console.log("  ✔ Stock transfer validation & ledger verified");

// 2. Cycle counting
const cyc = recordCycleCount(
  {
    productId: 101,
    variantId: "var_1",
    warehouseId: "wh_khi",
    systemQuantity: 50,
    countedQuantity: 47,
    reconcile: true,
  },
  "usr_ops_1",
);
assert.equal(cyc.variance, -3);
assert.equal(cyc.reconciled, true);
console.log("  ✔ Cycle count variance calculation verified");

// 3. Safety stock & reservation expiry policies
const policy = upsertSafetyStockPolicy({
  productId: 101,
  variantId: "var_1",
  warehouseId: "wh_khi",
  safetyStock: 12,
  reorderPoint: 30,
  reservationExpirySeconds: 600,
  flashSaleExpirySeconds: 180,
  maxExtensions: 2,
});
assert.equal(policy.safetyStock, 12);
assert.equal(getSafetyStockPolicy(101, "var_1", "wh_khi").flashSaleExpirySeconds, 180);
console.log("  ✔ Safety stock & reservation expiry policy verified");
