import assert from "node:assert/strict";
import {
  OUTBOX_CLUSTER_LEADER_KEY,
  OUTBOX_MAX_RETRIES,
  OUTBOX_WORKER_ID,
  processOutboxBatch,
} from "../src/outbox/outbox-relay.js";
import { prisma } from "@repo/product-db";
import { producer } from "../src/utils/kafka.js";
import { redis } from "../src/utils/redis.js";

async function runOutboxRelayTests() {
  console.log("==================================================");
  console.log("📦 product-service Transactional Outbox Test Suite");
  console.log("==================================================\n");

  // Track original methods to restore after test
  const originalCount = prisma.outboxEvent.count;
  const originalFindMany = prisma.outboxEvent.findMany;
  const originalUpdate = prisma.outboxEvent.update;
  const originalDeleteMany = prisma.outboxEvent.deleteMany;
  const originalSend = producer.send;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Worker ID and Cluster Leader Invariants
    // -------------------------------------------------------------------------
    console.log("1. Testing worker ID & cluster leader lock invariants...");
    assert.ok(OUTBOX_WORKER_ID.length > 5, "Worker ID must be non-empty");
    assert.equal(
      OUTBOX_CLUSTER_LEADER_KEY,
      "product:outbox:sweeper:leader",
      "Leader key must match platform Redis cluster schema",
    );
    assert.equal(OUTBOX_MAX_RETRIES, 5, "Max retries must be 5");
    console.log("  ✓ Cluster leader lock invariants validated");

    // -------------------------------------------------------------------------
    // TEST 2: Empty Queue Processing
    // -------------------------------------------------------------------------
    console.log("\n2. Testing empty outbox queue processing...");
    (prisma.outboxEvent as any).count = async () => 0;
    (prisma.outboxEvent as any).findMany = async () => [];

    const emptyProcessed = await processOutboxBatch();
    assert.equal(emptyProcessed, 0, "Empty queue must process 0 events");
    console.log("  ✓ Empty queue handled gracefully with 0 DB iterations");

    // -------------------------------------------------------------------------
    // TEST 3: Successful Event Dispatch & Status Transition
    // -------------------------------------------------------------------------
    console.log("\n3. Testing event dispatch and PUBLISHED status transition...");
    const mockEvents = [
      {
        id: "evt-prod-101",
        topic: "product.created",
        payload: { id: 101, name: "Premium Running Shoes", price: 12000 },
        status: "PENDING",
        retryCount: 0,
        createdAt: new Date(),
      },
      {
        id: "evt-prod-102",
        topic: "product.updated",
        payload: { id: 102, name: "Updated Gym Hoodie", price: 4500 },
        status: "PENDING",
        retryCount: 0,
        createdAt: new Date(),
      },
    ];

    const publishedKafka: Array<{ topic: string; value: any; key?: string }> = [];
    const updatedEvents: Array<{ id: string; data: any }> = [];

    (prisma.outboxEvent as any).count = async () => mockEvents.length;
    (prisma.outboxEvent as any).findMany = async () => mockEvents;
    (prisma.outboxEvent as any).deleteMany = async () => ({ count: 0 });
    (producer as any).send = async (topic: string, message: any, options?: any) => {
      publishedKafka.push({ topic, value: message.value, key: options?.key });
    };
    (prisma.outboxEvent as any).update = async ({ where, data }: any) => {
      updatedEvents.push({ id: where.id, data });
      return { id: where.id, ...data };
    };

    const processedCount = await processOutboxBatch();

    assert.equal(processedCount, 2, "Must process both mock outbox events");
    assert.equal(publishedKafka.length, 2, "Must publish 2 messages to Kafka");
    assert.equal(publishedKafka[0]?.topic, "product.created");
    assert.equal(publishedKafka[0]?.key, "101", "Must derive partition key from product id");
    assert.equal(publishedKafka[1]?.topic, "product.updated");
    assert.equal(publishedKafka[1]?.key, "102");

    assert.equal(updatedEvents.length, 2, "Must transition both records in DB");
    assert.equal(updatedEvents[0]?.data.status, "PUBLISHED");
    assert.ok(updatedEvents[0]?.data.publishedAt instanceof Date);
    assert.equal(updatedEvents[1]?.data.status, "PUBLISHED");
    console.log("  ✓ Successfully dispatched events to Kafka and updated status to PUBLISHED");

    // -------------------------------------------------------------------------
    // TEST 4: Transient Error Retry & Terminal Failure Transition
    // -------------------------------------------------------------------------
    console.log("\n4. Testing transient error retry and terminal FAILED state...");
    const failingEvent = {
      id: "evt-prod-error",
      topic: "product.deleted",
      payload: 999,
      status: "PENDING",
      retryCount: 4, // 4 retries already -> 5th retry must fail terminal
      createdAt: new Date(),
    };

    const failedUpdates: Array<{ id: string; data: any }> = [];
    (prisma.outboxEvent as any).count = async () => 1;
    (prisma.outboxEvent as any).findMany = async () => [failingEvent];
    (producer as any).send = async () => {
      throw new Error("Simulated Kafka Broker Connection Timeout");
    };
    (prisma.outboxEvent as any).update = async ({ where, data }: any) => {
      failedUpdates.push({ id: where.id, data });
      return { id: where.id, ...data };
    };

    const failedProcessed = await processOutboxBatch();
    assert.equal(failedProcessed, 0, "No events should count as successfully published");
    assert.equal(failedUpdates.length, 1, "Must update the failing record");
    assert.equal(failedUpdates[0]?.data.retryCount, 5, "Must increment retryCount to 5");
    assert.equal(
      failedUpdates[0]?.data.status,
      "FAILED",
      "5th retry must transition status to FAILED",
    );
    assert.ok(
      failedUpdates[0]?.data.lastError.includes("Simulated Kafka Broker Connection Timeout"),
    );
    console.log("  ✓ Correctly incremented retry count and marked terminal failure as FAILED");

    console.log("\n==================================================");
    console.log("🎉 ALL PRODUCT OUTBOX RELAY TESTS PASSED (100%)");
    console.log("==================================================\n");
  } finally {
    // Restore original methods
    (prisma.outboxEvent as any).count = originalCount;
    (prisma.outboxEvent as any).findMany = originalFindMany;
    (prisma.outboxEvent as any).update = originalUpdate;
    (prisma.outboxEvent as any).deleteMany = originalDeleteMany;
    (producer as any).send = originalSend;

    // Disconnect Redis to permit clean test exit
    try {
      await redis.close();
    } catch {
      // Ignored during teardown
    }
  }
}

runOutboxRelayTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
