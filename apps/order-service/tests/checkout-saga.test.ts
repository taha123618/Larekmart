/**
 * Test Suite: Distributed Checkout Saga Orchestrator Invariants
 *
 * Verifies:
 * 1. Initial Phase: Order created in `pending_confirmation` status with `sagaHistory` and `paymentSessionId`.
 * 2. Idempotency Invariant: Duplicate `payment.successful` payload does not duplicate orders.
 * 3. Happy Path: `confirmOrder` transitions order to `confirmed` and dispatches `order.confirmed`.
 * 4. Compensation Path: `cancelOutOfStockOrder` transitions order to `cancelled_out_of_stock` and dispatches `payment.refund.requested`.
 * 5. Terminal Refund Phase: `markOrderRefunded` transitions order to `refunded` and records `refundId`.
 */

import assert from "node:assert";
import { Order, mongoose } from "@repo/order-db";
import { producer } from "../src/utils/kafka.js";
import {
  createOrder,
  confirmOrder,
  cancelOutOfStockOrder,
  markOrderRefunded,
  processPendingConfirmationTimeouts,
} from "../src/utils/order.js";

const MONGO_URI =
  process.env.MONGO_URL || "mongodb://localhost:27017/larekmart_order_db";

async function runSagaTests() {
  console.log(
    "=== Running Distributed Checkout Saga Orchestrator Test Suite ===\n",
  );

  await mongoose.connect(MONGO_URI);
  await Order.deleteMany({ email: "saga-tester@example.com" });

  // Mock producer.send to capture and verify Saga event dispatches without requiring live Kafka broker
  const sentEvents: Array<{ topic: string; message: any }> = [];
  producer.send = (async (topic: string, message: any) => {
    sentEvents.push({ topic, message });
  }) as any;

  const testSessionId = `cs_test_saga_${Date.now()}`;
  const testReservationId = `res_test_saga_${Date.now()}`;
  const testUserId = "user_saga_tester";

  try {
    // 1. Initial Phase: Create Order in PENDING_CONFIRMATION
    console.log("1. Testing initial order creation in pending_confirmation...");
    const orderPayload = {
      sessionId: testSessionId,
      referenceId: testSessionId,
      reservationId: testReservationId,
      userId: testUserId,
      email: "saga-tester@example.com",
      amount: 15000,
      taxAmount: 500,
      taxCalculationId: "tax_calc_123",
      paymentMethod: "card",
      products: [
        { name: "Trail Boot", quantity: 1, price: 15000, sellerId: "seller_1" },
      ],
    };

    const createdOrder = await createOrder(orderPayload);
    assert.strictEqual(
      createdOrder.status,
      "pending_confirmation",
      "Order status must initially be pending_confirmation",
    );
    assert.strictEqual(
      (createdOrder as any).paymentSessionId,
      testSessionId,
      "paymentSessionId must be persisted",
    );
    assert.strictEqual(
      (createdOrder as any).reservationId,
      testReservationId,
      "reservationId must be persisted",
    );
    assert.strictEqual(
      (createdOrder as any).sagaHistory.length,
      1,
      "sagaHistory must contain initial step",
    );

    const initialEvent = sentEvents.find((e) => e.topic === "order.created");
    assert.ok(initialEvent, "order.created event must be emitted");
    assert.strictEqual(
      initialEvent.message.value.status,
      "pending_confirmation",
      "order.created must carry status pending_confirmation",
    );
    console.log("✓ Initial order creation in pending_confirmation passed.");

    // 2. Idempotency: Duplicate payment.successful does not duplicate
    console.log("2. Testing idempotency of duplicate payment.successful...");
    const duplicateOrder = await createOrder(orderPayload);
    assert.strictEqual(
      duplicateOrder._id.toString(),
      createdOrder._id.toString(),
      "Duplicate payment event must return existing order document without creating a new one",
    );
    console.log("✓ Idempotency verified.");

    // 3. Compensation Path: Simulate inventory reservation failure on a separate order
    console.log(
      "3. Testing Saga compensation (inventory reservation failure)...",
    );
    const failSessionId = `cs_test_fail_${Date.now()}`;
    const failReservationId = `res_test_fail_${Date.now()}`;
    const failOrder = await createOrder({
      ...orderPayload,
      sessionId: failSessionId,
      referenceId: failSessionId,
      reservationId: failReservationId,
    });

    await cancelOutOfStockOrder({
      reservationId: failReservationId,
      referenceId: failSessionId,
      reason: "INSUFFICIENT_STOCK",
      details: "Item sold out in flash sale race condition",
    });

    const updatedFailOrder = await Order.findById(failOrder._id);
    assert.strictEqual(
      updatedFailOrder?.status,
      "cancelled_out_of_stock",
      "Order must transition to cancelled_out_of_stock",
    );
    const lastHistory = (updatedFailOrder as any).sagaHistory.slice(-1)[0];
    assert.strictEqual(
      lastHistory.state,
      "cancelled_out_of_stock",
      "Saga history must record cancelled_out_of_stock transition",
    );

    const refundRequestedEvent = sentEvents.find(
      (e) =>
        e.topic === "payment.refund.requested" &&
        e.message.value.orderId === failOrder._id.toString(),
    );
    assert.ok(
      refundRequestedEvent,
      "payment.refund.requested must be dispatched to payment-service",
    );

    const cancelledEvent = sentEvents.find(
      (e) =>
        e.topic === "order.cancelled" &&
        e.message.value.orderId === failOrder._id.toString(),
    );
    assert.ok(
      cancelledEvent,
      "order.cancelled must be dispatched to shipping, promotion, and notification services",
    );
    console.log(
      "✓ Saga compensation on inventory failure passed (refund requested & order.cancelled emitted).",
    );

    // 4. Terminal Refund Phase: Stripe refund completed
    console.log(
      "4. Testing Terminal Refund Phase (payment.refund.completed)...",
    );
    await markOrderRefunded({
      orderId: failOrder._id.toString(),
      refundId: "re_mock_refund_123",
      paymentSessionId: failSessionId,
    });

    const refundedOrder = await Order.findById(failOrder._id);
    assert.strictEqual(
      refundedOrder?.status,
      "refunded",
      "Order must transition to refunded",
    );
    assert.strictEqual(
      (refundedOrder as any).refundId,
      "re_mock_refund_123",
      "refundId must be recorded on the order document",
    );
    console.log("✓ Terminal refund transition passed.");

    // 5. Happy Path: Confirm original order on inventory.stock.sold
    console.log(
      "5. Testing Happy Path: confirmOrder on inventory.stock.sold...",
    );
    await confirmOrder({
      reservationId: testReservationId,
      referenceId: testSessionId,
    });

    const confirmedOrder = await Order.findById(createdOrder._id);
    assert.strictEqual(
      confirmedOrder?.status,
      "confirmed",
      "Order must transition to confirmed upon inventory stock sold",
    );

    const confirmedEvent = sentEvents.find(
      (e) =>
        e.topic === "order.confirmed" &&
        e.message.value.orderId === createdOrder._id.toString(),
    );
    assert.ok(
      confirmedEvent,
      "order.confirmed event must be dispatched to cart-service and shipping-service",
    );
    console.log("✓ Order confirmed transition passed.");

    // 6. Timeout Sweeper Path: Simulate an order whose inventory confirmation timed out
    console.log(
      "6. Testing Saga Confirmation Timeout Sweeper (stuck pending_confirmation order)...",
    );
    const timeoutSessionId = `cs_test_timeout_${Date.now()}`;
    const timeoutReservationId = `res_test_timeout_${Date.now()}`;
    const timeoutOrder = await createOrder({
      ...orderPayload,
      sessionId: timeoutSessionId,
      referenceId: timeoutSessionId,
      reservationId: timeoutReservationId,
    });

    // Manually backdate createdAt on raw MongoDB collection to bypass Mongoose timestamp locking
    await Order.collection.updateOne(
      { _id: timeoutOrder._id },
      { $set: { createdAt: new Date(Date.now() - 65000) } },
    );

    // Run timeout sweeper with 60000ms threshold
    const processedCount = await processPendingConfirmationTimeouts(60000);
    assert.strictEqual(
      processedCount >= 1,
      true,
      "Sweeper must find and process the timed-out order",
    );

    const timedOutUpdatedOrder = await Order.findById(timeoutOrder._id);
    assert.strictEqual(
      timedOutUpdatedOrder?.status,
      "cancelled_out_of_stock",
      "Timed out order must transition to cancelled_out_of_stock",
    );

    const timeoutRefundEvent = sentEvents.find(
      (e) =>
        e.topic === "payment.refund.requested" &&
        e.message.value.orderId === timeoutOrder._id.toString(),
    );
    assert.ok(
      timeoutRefundEvent,
      "Timeout sweeper must emit payment.refund.requested for abandoned order",
    );
    console.log("✓ Saga confirmation timeout sweeper passed.");

    // Cleanup test documents
    await Order.deleteMany({
      _id: { $in: [createdOrder._id, failOrder._id, timeoutOrder._id] },
    });
    console.log("\n=======================================================");
    console.log(" All Distributed Checkout Saga Tests Passed Successfully! ");
    console.log("=======================================================\n");
  } finally {
    await mongoose.disconnect();
  }
}

runSagaTests().catch((err) => {
  console.error("❌ Checkout Saga Test Failed:", err);
  process.exit(1);
});
