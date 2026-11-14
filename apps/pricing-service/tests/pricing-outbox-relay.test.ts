import assert from "node:assert/strict";
import {
  PRICING_OUTBOX_CLUSTER_LEADER_KEY,
  PRICING_OUTBOX_MAX_RETRIES,
  PRICING_OUTBOX_WORKER_ID,
  processPricingOutboxBatch,
} from "../src/workers/outbox-relay.js";
import { db } from "../src/db/connection.js";
import { producer } from "../src/utils/kafka.js";
import { redis } from "../src/utils/redis.js";

async function runPricingOutboxRelayTests() {
  console.log("==================================================");
  console.log("📦 pricing-service Transactional Outbox Test Suite");
  console.log("==================================================\n");

  const originalSelect = db.select;
  const originalUpdate = db.update;
  const originalDelete = db.delete;
  const originalSend = producer.send;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Worker ID & Cluster Leader Invariants
    // -------------------------------------------------------------------------
    console.log("1. Testing worker ID & cluster leader lock invariants...");
    assert.ok(
      PRICING_OUTBOX_WORKER_ID.length > 5,
      "Worker ID must be non-empty",
    );
    assert.equal(
      PRICING_OUTBOX_CLUSTER_LEADER_KEY,
      "pricing:outbox:sweeper:leader",
      "Leader key must match platform Redis cluster schema",
    );
    assert.equal(PRICING_OUTBOX_MAX_RETRIES, 5, "Max retries must be 5");
    console.log("  ✓ Cluster leader lock invariants validated");

    // -------------------------------------------------------------------------
    // TEST 2: Empty Queue Processing
    // -------------------------------------------------------------------------
    console.log("\n2. Testing empty outbox queue processing...");
    (db as any).select = () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      }),
    });

    const emptyCount = await processPricingOutboxBatch();
    assert.equal(emptyCount, 0, "Empty queue must process 0 events");
    console.log("  ✓ Empty queue handled gracefully with 0 DB iterations");

    // -------------------------------------------------------------------------
    // TEST 3: Successful Event Dispatch & Status Transition
    // -------------------------------------------------------------------------
    console.log("\n3. Testing event dispatch and PUBLISHED status transition...");
    const mockEvents = [
      {
        id: "evt-price-001",
        topic: "pricing.price.created",
        payload: {
          productId: "prod_shoe_99",
          priceListId: "pl_default",
          basePrice: 4500,
          currency: "USD",
        },
        status: "PENDING",
        retryCount: 0,
        createdAt: new Date(),
      },
      {
        id: "evt-quote-002",
        topic: "pricing.quote.created",
        payload: {
          quoteId: "quote_xyz_777",
          subtotal: 9000,
          finalTotal: 8500,
          currency: "USD",
        },
        status: "PENDING",
        retryCount: 0,
        createdAt: new Date(),
      },
    ];

    const publishedKafka: Array<{ topic: string; value: any; key?: string }> = [];
    const updatedRecords: Array<{ id: string; values: any }> = [];

    (db as any).select = () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => mockEvents,
          }),
        }),
      }),
    });

    (producer as any).send = async (topic: string, message: any, options?: any) => {
      publishedKafka.push({ topic, value: message.value, key: options?.key });
    };

    (db as any).update = () => ({
      set: (values: any) => ({
        where: async (condition: any) => {
          updatedRecords.push({ id: "mock-id", values });
          return [];
        },
      }),
    });

    (db as any).delete = () => ({
      where: async () => [],
    });

    const processedCount = await processPricingOutboxBatch();

    assert.equal(processedCount, 2, "Must process both mock outbox events");
    assert.equal(publishedKafka.length, 2, "Must publish 2 messages to Kafka");
    assert.equal(publishedKafka[0]?.topic, "pricing.price.created");
    assert.equal(
      publishedKafka[0]?.key,
      "prod_shoe_99",
      "Must derive partition key from productId",
    );
    assert.equal(publishedKafka[1]?.topic, "pricing.quote.created");
    assert.equal(
      publishedKafka[1]?.key,
      "quote_xyz_777",
      "Must derive partition key from quoteId",
    );

    assert.equal(updatedRecords.length, 2, "Must update 2 records to PUBLISHED");
    assert.equal(updatedRecords[0]?.values.status, "PUBLISHED");
    assert.ok(updatedRecords[0]?.values.publishedAt instanceof Date);
    console.log("  ✓ Successfully dispatched events to Kafka and updated status to PUBLISHED");

    // -------------------------------------------------------------------------
    // TEST 4: Transient Error Retry & Terminal Failure Transition
    // -------------------------------------------------------------------------
    console.log("\n4. Testing transient error retry and terminal FAILED state...");
    const failingEvent = {
      id: "evt-failing-999",
      topic: "pricing.price.updated",
      payload: { productId: "prod_error_99" },
      status: "PENDING",
      retryCount: 4, // 5th retry must trigger FAILED status
      createdAt: new Date(),
    };

    const failedUpdates: Array<any> = [];
    (db as any).select = () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [failingEvent],
          }),
        }),
      }),
    });

    (producer as any).send = async () => {
      throw new Error("Simulated Kafka Broker Unreachable (Pricing)");
    };

    (db as any).update = () => ({
      set: (values: any) => ({
        where: async () => {
          failedUpdates.push(values);
          return [];
        },
      }),
    });

    const failedProcessed = await processPricingOutboxBatch();
    assert.equal(failedProcessed, 0, "No events should count as published");
    assert.equal(failedUpdates.length, 1, "Must update the failing record");
    assert.equal(failedUpdates[0]?.retryCount, 5, "Must increment retryCount to 5");
    assert.equal(
      failedUpdates[0]?.status,
      "FAILED",
      "5th retry must transition status to FAILED",
    );
    assert.ok(
      failedUpdates[0]?.lastError.includes("Simulated Kafka Broker Unreachable"),
    );
    console.log("  ✓ Correctly incremented retry count and marked terminal failure as FAILED");

    console.log("\n==================================================");
    console.log("🎉 ALL PRICING OUTBOX RELAY TESTS PASSED (100%)");
    console.log("==================================================\n");
  } finally {
    (db as any).select = originalSelect;
    (db as any).update = originalUpdate;
    (db as any).delete = originalDelete;
    (producer as any).send = originalSend;

    try {
      await redis.close();
    } catch {
      // Ignored during teardown
    }
  }
}

runPricingOutboxRelayTests().catch((err) => {
  console.error("Pricing outbox relay test failed:", err);
  process.exit(1);
});
