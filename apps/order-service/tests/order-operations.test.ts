import assert from "node:assert/strict";
import {
  splitOrderBySeller,
  recordPartialFulfillment,
  registerBackorders,
  getOrderBackorders,
  recordOrderAmendment,
  getOrderAmendments,
} from "../src/services/order-operations.service.js";

console.log("=== order-service Operations Unit Tests ===");

// 1. Split orders by seller with proportional tax & shipping
const splits = splitOrderBySeller({
  items: [
    { productId: "p1", sellerId: "seller_a", quantity: 2, price: 50 },
    { productId: "p2", sellerId: "seller_b", quantity: 1, price: 100 },
  ],
  totalTax: 20,
  totalShipping: 10,
});
assert.equal(splits.length, 2);
const splitA = splits.find((s) => s.sellerId === "seller_a");
const splitB = splits.find((s) => s.sellerId === "seller_b");
assert.equal(splitA?.subtotal, 100);
assert.equal(splitA?.proportionalTax, 10);
assert.equal(splitA?.proportionalShipping, 5);
assert.equal(splitB?.total, 115);
console.log("  ✔ Split orders by seller proportional math verified");

// 2. Partial fulfillment tracking
const orderItems = [
  { productId: "prod_1", quantity: 4 },
  { productId: "prod_2", quantity: 2 },
];
const part1 = recordPartialFulfillment({
  orderId: "ord_op_1",
  sellerId: "seller_a",
  orderItems,
  fulfillmentItems: [{ productId: "prod_1", quantityFulfilled: 2 }],
  carrier: "TCS",
  trackingNumber: "TCS-111",
});
assert.equal(part1.isFullyFulfilled, false);
assert.equal(part1.totalFulfilledUnits, 2);

const part2 = recordPartialFulfillment({
  orderId: "ord_op_1",
  sellerId: "seller_a",
  orderItems,
  fulfillmentItems: [
    { productId: "prod_1", quantityFulfilled: 2 },
    { productId: "prod_2", quantityFulfilled: 2 },
  ],
  carrier: "DHL",
  trackingNumber: "DHL-222",
});
assert.equal(part2.isFullyFulfilled, true);
assert.equal(part2.totalFulfilledUnits, 6);

assert.throws(() =>
  recordPartialFulfillment({
    orderId: "ord_op_1",
    sellerId: "seller_a",
    orderItems,
    fulfillmentItems: [{ productId: "prod_1", quantityFulfilled: 1 }],
  }),
);
console.log("  ✔ Partial fulfillment & over-fulfillment guard verified");

// 3. Backorders
const createdBackorders = registerBackorders({
  orderId: "ord_op_2",
  items: [{ productId: "prod_99", backorderQuantity: 3, expectedRestockDate: "2026-12-01" }],
});
assert.equal(createdBackorders.length, 1);
assert.equal(getOrderBackorders("ord_op_2").length, 1);
console.log("  ✔ Backorder registration & retrieval verified");

// 4. Order amendments & post-shipment lock
const amd = recordOrderAmendment({
  orderId: "ord_op_3",
  actorId: "usr_1",
  currentStatus: "confirmed",
  type: "SHIPPING_ADDRESS",
  reason: "Customer moved apartment",
  previousValue: "Old St",
  newValue: "New Ave",
});
assert.equal(amd.type, "SHIPPING_ADDRESS");
assert.equal(getOrderAmendments("ord_op_3").length, 1);

assert.throws(() =>
  recordOrderAmendment({
    orderId: "ord_op_3",
    actorId: "usr_1",
    currentStatus: "shipped",
    type: "SHIPPING_ADDRESS",
    reason: "Too late",
    previousValue: "Old St",
    newValue: "New Ave",
  }),
);
console.log("  ✔ Order amendment audit & post-shipment lock verified");
