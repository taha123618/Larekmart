/**
 * Test Suite: Distributed Multi-DB Checkout Saga Orchestrator Invariants
 *
 * Verifies:
 * 1. Initial Phase: Order created in `pending_confirmation` status with `taxStatus: pending` and `inventoryStatus: pending`.
 * 2. Idempotency Invariant: Duplicate `payment.successful` payload does not duplicate orders.
 * 3. Dual-ACK Coordination: Order transitions to `confirmed` only after BOTH `inventory.stock.sold` AND `tax.calculation.completed`.
 * 4. Tax Failure Compensation: `handleTaxFailed` transitions order to `cancelled_tax_mismatch` and dispatches refund + inventory release.
 * 5. Inventory Failure Compensation: `cancelOutOfStockOrder` transitions order and dispatches refund + tax void.
 * 6. Terminal Refund Phase: `markOrderRefunded` transitions order to `refunded`.
 * 7. Timeout Sweeper: Sweeps orders exceeding the confirmation threshold.
 */

import assert from "node:assert";
import { Order, mongoose } from "@repo/order-db";
import { producer } from "../src/utils/kafka.js";
import {
  createOrder,
  confirmOrder,
  handleTaxCompleted,
  handleTaxFailed,
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
    // 1. Initial Phase: Create Order in PENDING_CONFIRMATION with Dual-ACK pending flags
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
      (createdOrder as any).taxStatus,
      "pending",
      "taxStatus must initially be pending when taxCalculationId is provided",
    );
    assert.strictEqual(
      (createdOrder as any).inventoryStatus,
      "pending",
      "inventoryStatus must initially be pending",
    );
    assert.strictEqual(
      (createdOrder as any).paymentSessionId,
      testSessionId,
      "paymentSessionId must be persisted",
    );
    assert.strictEqual(
      (createdOrder as any).sagaHistory.length,
      1,
      "sagaHistory must contain initial step",
    );

    const initialEvent = sentEvents.find((e) => e.topic === "order.created");
    assert.ok(initialEvent, "order.created event must be emitted");
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

    // 3. Dual-ACK Step A: Inventory sold, awaiting tax confirmation
    console.log(
      "3. Testing Dual-ACK Step A: Inventory sold, awaiting tax completion...",
    );
    await confirmOrder({
      reservationId: testReservationId,
      referenceId: testSessionId,
    });

    const awaitingTaxOrder = await Order.findById(createdOrder._id);
    assert.strictEqual(
      awaitingTaxOrder?.status,
      "pending_confirmation",
      "Order must remain in pending_confirmation while tax is still pending",
    );
    assert.strictEqual(
      (awaitingTaxOrder as any).inventoryStatus,
      "sold",
      "inventoryStatus must be sold",
    );
    console.log(
      "✓ Order correctly held in pending_confirmation awaiting tax completion.",
    );

    // 3. Dual-ACK Step B: Tax settled -> dual-ACK met -> transitions to confirmed
    console.log(
      "4. Testing Dual-ACK Step B: Tax calculation settled -> order confirmed...",
    );
    await handleTaxCompleted({
      calculationId: "tax_calc_123",
      referenceId: createdOrder._id.toString(),
      referenceType: "order",
      currency: "USD",
      subtotal: "150.00",
      taxTotal: "5.00",
      total: "155.00",
      ruleVersion: "2026-10",
      completedAt: new Date().toISOString(),
    });

    const confirmedOrder = await Order.findById(createdOrder._id);
    assert.strictEqual(
      confirmedOrder?.status,
      "confirmed",
      "Order must transition to confirmed upon achieving Dual-ACK",
    );
    assert.strictEqual(
      (confirmedOrder as any).taxStatus,
      "completed",
      "taxStatus must be completed",
    );

    const confirmedEvent = sentEvents.find(
      (e) =>
        e.topic === "order.confirmed" &&
        e.message.value.orderId === createdOrder._id.toString(),
    );
    assert.ok(
      confirmedEvent,
      "order.confirmed event must be dispatched once Dual-ACK is achieved",
    );
    console.log("✓ Dual-ACK confirmed transition passed.");

    // 5. Compensation Path: Tax calculation failure compensation
    console.log("5. Testing Saga compensation on Tax calculation failure...");
    const taxFailSessionId = `cs_test_taxfail_${Date.now()}`;
    const taxFailReservationId = `res_test_taxfail_${Date.now()}`;
    const taxFailOrder = await createOrder({
      ...orderPayload,
      sessionId: taxFailSessionId,
      referenceId: taxFailSessionId,
      reservationId: taxFailReservationId,
      taxCalculationId: "tax_calc_invalid",
    });

    await handleTaxFailed({
      calculationId: "tax_calc_invalid",
      referenceId: taxFailOrder._id.toString(),
      referenceType: "order",
      error: "Tax rate discrepancy or jurisdiction not found",
      failedAt: new Date().toISOString(),
    });

    const updatedTaxFailOrder = await Order.findById(taxFailOrder._id);
    assert.strictEqual(
      updatedTaxFailOrder?.status,
      "cancelled_tax_mismatch",
      "Order must transition to cancelled_tax_mismatch",
    );

    const taxFailRefundEvent = sentEvents.find(
      (e) =>
        e.topic === "payment.refund.requested" &&
        e.message.value.orderId === taxFailOrder._id.toString(),
    );
    assert.ok(
      taxFailRefundEvent,
      "payment.refund.requested must be dispatched to refund customer",
    );

    const taxFailInvCancelEvent = sentEvents.find(
      (e) =>
        e.topic === "inventory.reservation.cancelled" &&
        e.message.value.orderId === taxFailOrder._id.toString(),
    );
    assert.ok(
      taxFailInvCancelEvent,
      "inventory.reservation.cancelled must be dispatched to release PostgreSQL stock",
    );
    console.log(
      "✓ Tax failure compensation passed (refund + inventory release emitted).",
    );

    // 6. Compensation Path: Inventory reservation failure with Tax Voiding
    console.log(
      "6. Testing Saga compensation on Inventory failure (with tax voiding)...",
    );
    const invFailSessionId = `cs_test_invfail_${Date.now()}`;
    const invFailReservationId = `res_test_invfail_${Date.now()}`;
    const invFailOrder = await createOrder({
      ...orderPayload,
      sessionId: invFailSessionId,
      referenceId: invFailSessionId,
      reservationId: invFailReservationId,
      taxCalculationId: "tax_calc_to_void",
    });

    await cancelOutOfStockOrder({
      reservationId: invFailReservationId,
      referenceId: invFailSessionId,
      reason: "INSUFFICIENT_STOCK",
      details: "Item sold out in flash sale race condition",
    });

    const updatedInvFailOrder = await Order.findById(invFailOrder._id);
    assert.strictEqual(
      updatedInvFailOrder?.status,
      "cancelled_out_of_stock",
      "Order must transition to cancelled_out_of_stock",
    );

    const invFailTaxVoidEvent = sentEvents.find(
      (e) =>
        e.topic === "tax.calculation.voided" &&
        e.message.value.calculationId === "tax_calc_to_void",
    );
    assert.ok(
      invFailTaxVoidEvent,
      "tax.calculation.voided must be dispatched to MySQL tax service",
    );
    console.log("✓ Inventory failure compensation passed (tax void emitted).");

    // 7. Terminal Refund Phase: Stripe refund completed
    console.log(
      "7. Testing Terminal Refund Phase (payment.refund.completed)...",
    );
    await markOrderRefunded({
      orderId: invFailOrder._id.toString(),
      refundId: "re_mock_refund_123",
      paymentSessionId: invFailSessionId,
    });

    const refundedOrder = await Order.findById(invFailOrder._id);
    assert.strictEqual(
      refundedOrder?.status,
      "refunded",
      "Order must transition to refunded",
    );
    console.log("✓ Terminal refund transition passed.");

    // 8. Timeout Sweeper Path: Simulate an order whose Dual-ACK timed out
    console.log("8. Testing Saga Confirmation Timeout Sweeper...");
    const timeoutSessionId = `cs_test_timeout_${Date.now()}`;
    const timeoutReservationId = `res_test_timeout_${Date.now()}`;
    const timeoutOrder = await createOrder({
      ...orderPayload,
      sessionId: timeoutSessionId,
      referenceId: timeoutSessionId,
      reservationId: timeoutReservationId,
    });

    // Manually backdate createdAt on raw MongoDB collection
    await Order.collection.updateOne(
      { _id: timeoutOrder._id },
      { $set: { createdAt: new Date(Date.now() - 65000) } },
    );

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
    console.log("✓ Saga confirmation timeout sweeper passed.");

    // Cleanup test documents
    await Order.deleteMany({
      _id: {
        $in: [
          createdOrder._id,
          taxFailOrder._id,
          invFailOrder._id,
          timeoutOrder._id,
        ],
      },
    });
    console.log("\n=======================================================");
    console.log(" All Distributed Multi-DB Saga Tests Passed Successfully! ");
    console.log("=======================================================\n");
  } finally {
    const { redis } = await import("../src/utils/redis.js");
    await redis.close();
    await mongoose.disconnect();
  }
}

runSagaTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Checkout Saga Test Failed:", err);
    process.exit(1);
  });
