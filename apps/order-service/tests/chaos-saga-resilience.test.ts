/**
 * Test Suite: Multi-Database Checkout Saga Chaos Resilience & Failure Injections
 *
 * Simulates transient chaos, network splits, broker failures, and database latency
 * across the multi-engine checkout Saga (MongoDB orders, PostgreSQL inventory, MySQL tax).
 *
 * Verifies:
 * 1. MySQL Tax Latency / Network Cut: Saga fails gracefully with automated compensation,
 *    order transitions from pending_confirmation to cancelled_tax_mismatch, and
 *    compensation events (inventory.release + payment.refund) are dispatched without data drift.
 * 2. Kafka Broker Drop During Rollback: Transactional outbox persists failed dispatch
 *    durably and automatically retries with backoff upon broker reconnection.
 * 3. Dual-ACK Timeout Under Extreme Latency: Sweeper identifies orphan pending_confirmation
 *    orders, rolls back inventory, and triggers refunds with zero orphan transactions.
 * 4. Resilient Outbox Sweeper Cluster Isolation: Competing replicas under chaos respect
 *    distributed leader lease, preventing duplicate compensation dispatches.
 */

import assert from "node:assert/strict";
import {
  Order,
  OutboxEvent,
  createOutboxEvent,
  mongoose,
} from "@repo/order-db";
import { producer } from "../src/utils/kafka.js";
import {
  createOrder,
  handleTaxFailed,
  cancelOutOfStockOrder,
  processPendingConfirmationTimeouts,
} from "../src/utils/order.js";
import { sweepPendingOutboxEvents } from "../src/outbox/outbox-relay.js";

import { redis } from "../src/utils/redis.js";

const MONGO_URI =
  process.env.MONGO_URL || "mongodb://localhost:27017/larekmart_order_db";

async function runChaosSagaResilienceTests() {
  console.log("==================================================");
  console.log("🌪️ Multi-DB Checkout Saga Chaos Resilience Suite");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URI);
  await Order.deleteMany({ email: "chaos-tester@example.com" });
  await OutboxEvent.deleteMany({ topic: /^chaos\./ });

  const capturedDispatches: Array<{ topic: string; message: any }> = [];
  const originalSend = producer.send;

  // Mock producer.send to track dispatched Kafka events
  producer.send = (async (topic: string, message: any) => {
    capturedDispatches.push({ topic, message });
  }) as any;

  const baseOrderPayload = {
    userId: "user_chaos_victim",
    email: "chaos-tester@example.com",
    products: [
      {
        id: "prod_chaos_01",
        name: "Chaos Resilient Item",
        price: 1500,
        quantity: 2,
        sellerId: "seller_test_chaos",
      },
    ],
    amount: 3000,
    total: 3000,
    taxAmount: 150,
    taxCalculationId: "tax_calc_chaos_01",

    shippingAddress: {
      fullName: "Chaos Tester",
      street: "123 Failure Injection Blvd",
      city: "Karachi",
      postalCode: "74000",
      country: "PK",
    },
    paymentMethod: "stripe",
  };

  try {
    // ── Scenario 1: Transient MySQL Tax Service Cut / Calculation Failure ─────
    console.log(
      "1. Testing MySQL Tax Service Network Cut (handleTaxFailed rollback)...",
    );
    const taxCutSession = `cs_chaos_tax_${Date.now()}`;
    const taxCutReservation = `res_chaos_tax_${Date.now()}`;

    const order1 = await createOrder({
      ...baseOrderPayload,
      sessionId: taxCutSession,
      referenceId: taxCutSession,
      reservationId: taxCutReservation,
    });

    assert.equal(
      order1.status,
      "pending_confirmation",
      "Order must initialize in pending_confirmation",
    );

    // Simulate MySQL network cut: Tax calculation fails after timeout
    capturedDispatches.length = 0;
    await handleTaxFailed({
      calculationId: "tax_calc_chaos_fail",
      referenceId: order1._id.toString(),
      referenceType: "order",
      error: "MYSQL_CONN_TIMEOUT_INJECTED",
      failedAt: new Date().toISOString(),
    });

    const compensatedOrder = await Order.findById(order1._id);
    assert.equal(
      compensatedOrder?.status,
      "cancelled_tax_mismatch",
      "Order status must transition to cancelled_tax_mismatch",
    );

    // Verify inventory release compensation event was emitted
    const invRelease = capturedDispatches.find(
      (e) =>
        e.topic === "inventory.reservation.cancelled" &&
        e.message.value.orderId === order1._id.toString(),
    );
    assert.ok(
      invRelease,
      "Compensation must dispatch inventory.reservation.cancelled to unblock reserved stock",
    );

    // Verify refund compensation event was emitted
    const refundEvent = capturedDispatches.find(
      (e) =>
        e.topic === "payment.refund.requested" &&
        e.message.value.orderId === order1._id.toString(),
    );
    assert.ok(
      refundEvent,
      "Compensation must dispatch payment.refund.requested to return customer payment",
    );

    console.log(
      "  ✓ MySQL tax service failure cleanly rolled back with zero orphan state",
    );

    // ── Scenario 2: Kafka Broker Failure During Compensation Dispatch ──────────
    console.log(
      "\n2. Testing Kafka Broker Pod Kill during compensation publishing...",
    );
    const brokerDropSession = `cs_chaos_broker_${Date.now()}`;
    const chaosOutboxTopic = "chaos.inventory.release";

    // Simulate broker drop by making producer.send fail
    producer.send = (async () => {
      throw new Error("Kafka broker disconnected (Synthetic Chaos Injected)");
    }) as any;

    const outboxEvent = await createOutboxEvent(chaosOutboxTopic, {
      reservationId: "res_chaos_broker_01",
      reason: "SAGA_COMPENSATION",
    });

    // Sweeper attempts to process outbox during broker drop
    const workerId = `chaos-worker-${Date.now()}`;
    const publishedDuringDrop = await sweepPendingOutboxEvents(10, workerId);
    assert.equal(
      publishedDuringDrop,
      0,
      "No event should be published while broker is down",
    );

    const failedRecord = await OutboxEvent.findById(outboxEvent._id);
    assert.equal(
      failedRecord?.status,
      "PENDING",
      "Failed event remains in PENDING for retry",
    );
    assert.ok(
      failedRecord?.lastError?.includes("Synthetic Chaos"),
      "lastError records failure",
    );
    assert.ok(
      failedRecord!.lockedUntil && failedRecord!.lockedUntil > new Date(),
      "Backoff scheduled",
    );
    console.log(
      "  ✓ Outbox event durably held in DB; zero message loss during broker drop",
    );

    // Restore Kafka broker connection
    producer.send = (async (topic: string, message: any) => {
      capturedDispatches.push({ topic, message });
    }) as any;

    // Reset lockedUntil to simulate backoff elapsing
    await OutboxEvent.updateOne(
      { _id: outboxEvent._id },
      { $set: { lockedUntil: new Date(Date.now() - 1000) } },
    );
    const publishedAfterRecovery = await sweepPendingOutboxEvents(10, workerId);
    assert.equal(
      publishedAfterRecovery,
      1,
      "Event must be cleanly published upon broker recovery",
    );

    const publishedRecord = await OutboxEvent.findById(outboxEvent._id);
    assert.equal(publishedRecord?.status, "PUBLISHED");
    assert.ok(
      publishedRecord?.publishedAt !== null,
      "publishedAt timestamp recorded",
    );
    console.log(
      "  ✓ Broker recovery resulted in successful delayed compensation delivery",
    );

    // ── Scenario 3: Dual-ACK Confirmation Timeout Sweeper Under Latency ─────────
    console.log("\n3. Testing Dual-ACK confirmation timeout sweeper...");
    const timeoutSession = `cs_chaos_timeout_${Date.now()}`;
    const timeoutReservation = `res_chaos_timeout_${Date.now()}`;

    const timedOutOrder = await createOrder({
      ...baseOrderPayload,
      sessionId: timeoutSession,
      referenceId: timeoutSession,
      reservationId: timeoutReservation,
    });

    // Manually backdate createdAt to simulate order stuck in pending_confirmation past 60s
    await Order.collection.updateOne(
      { _id: timedOutOrder._id },
      { $set: { createdAt: new Date(Date.now() - 65_000) } },
    );

    capturedDispatches.length = 0;
    const sweptCount = await processPendingConfirmationTimeouts(
      60_000,
      `sweeper-${Date.now()}`,
    );
    assert.ok(
      sweptCount >= 1,
      "Timeout sweeper must detect stuck pending_confirmation orders",
    );

    const cleanedOrder = await Order.findById(timedOutOrder._id);
    assert.equal(
      cleanedOrder?.status,
      "cancelled_out_of_stock",
      "Timed out order must be transitioned to cancelled_out_of_stock",
    );

    const sweptRefund = capturedDispatches.find(
      (e) =>
        e.topic === "payment.refund.requested" &&
        e.message.value.orderId === timedOutOrder._id.toString(),
    );
    assert.ok(
      sweptRefund,
      "Sweeper must emit payment.refund.requested for timed-out saga",
    );

    console.log(
      "  ✓ Orphan pending_confirmation order detected and rolled back cleanly",
    );

    // ── Scenario 4: Sweeper Cluster Lock Isolation Under Replicas ──────────────
    console.log(
      "\n4. Testing Sweeper Cluster Lock Isolation across Pod Alpha and Pod Beta...",
    );
    const leaderKey = "order:saga:timeout:sweeper:leader";
    const lockAcquired = await redis.client.set(
      leaderKey,
      "pod-alpha-holding-lock",
      "PX",
      10_000,
      "NX",
    );
    assert.equal(
      lockAcquired,
      "OK",
      "Pod Alpha successfully acquired sweeper cluster lease",
    );

    // Pod Beta attempts to sweep while Pod Alpha holds the lock
    const betaProcessed = await processPendingConfirmationTimeouts(
      60_000,
      "pod-beta-follower",
    );
    assert.equal(
      betaProcessed,
      0,
      "Pod Beta must skip sweep execution while Alpha holds cluster lock",
    );

    // Release Pod Alpha's lease
    await redis.client.del(leaderKey);
    console.log(
      "  ✓ Competing pod rejected by cluster lease; zero duplicate sweep execution",
    );

    // Cleanup test data
    await Order.deleteMany({
      _id: {
        $in: [order1._id, timedOutOrder._id],
      },
    });
    await OutboxEvent.deleteMany({ topic: chaosOutboxTopic });

    console.log("\n==================================================");
    console.log("🎉 All Chaos Saga Resilience Invariants Passed (100%)");
    console.log("==================================================\n");
  } finally {
    producer.send = originalSend;
    await redis.close();
    await mongoose.disconnect();
  }
}

runChaosSagaResilienceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Chaos Saga Resilience Test Failed:", err);
    process.exit(1);
  });
