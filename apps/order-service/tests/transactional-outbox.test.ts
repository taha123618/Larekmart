/**
 * Test Suite: Transactional Outbox Pattern & Lease-Locked Sweeper Invariants
 *
 * Verifies:
 * 1. Outbox Event Persistence: Events are saved to MongoDB in PENDING status.
 * 2. Immediate Fast-Path Dispatch: Publishes to Kafka and transitions to PUBLISHED with publishedAt timestamp.
 * 3. Failure Handling & Retry: Kafka publish failure records error and schedules retry backoff without losing data.
 * 4. Atomic Lease Claiming: claimPendingOutboxEvents prevents concurrent duplicate worker execution.
 * 5. Resilient Sweeper Recovery: Background sweeper automatically recovers and delivers pending outbox events.
 */

import assert from "node:assert";
import {
  OutboxEvent,
  createOutboxEvent,
  claimPendingOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
  mongoose,
} from "@repo/order-db";
import { DistributedLeaderElector } from "@repo/redis";
import { producer } from "../src/utils/kafka.js";
import { redis } from "../src/utils/redis.js";
import {
  dispatchViaOutbox,
  publishOutboxEvent,
  sweepPendingOutboxEvents,
  startOutboxSweeper,
  stopOutboxSweeper,
} from "../src/outbox/outbox-relay.js";

const MONGO_URI =
  process.env.MONGO_URL || "mongodb://localhost:27017/larekmart_order_db";

async function runOutboxTests() {
  console.log(
    "=== Running Transactional Outbox & Sweeper Invariants Test Suite ===\n",
  );

  await mongoose.connect(MONGO_URI);
  await OutboxEvent.deleteMany({ topic: "test.outbox.event" });

  const capturedEvents: Array<{ topic: string; message: any }> = [];
  const originalSend = producer.send;

  // Mock Kafka producer
  producer.send = (async (topic: string, message: any) => {
    capturedEvents.push({ topic, message });
  }) as any;

  try {
    // 1. Outbox Event Creation
    console.log("1. Testing atomic OutboxEvent creation...");
    const testPayload = { orderId: "ord_123", amount: 9900 };
    const created = await createOutboxEvent("test.outbox.event", testPayload);

    assert.strictEqual(
      created.status,
      "PENDING",
      "Outbox event status must be PENDING on creation",
    );
    assert.strictEqual(
      created.attempts,
      0,
      "Initial attempt counter must be 0",
    );
    assert.strictEqual(created.topic, "test.outbox.event");
    console.log("✓ Outbox event persisted in PENDING status.");

    // 2. Direct Publish and State Transition
    console.log("2. Testing publishOutboxEvent transition to PUBLISHED...");
    const publishResult = await publishOutboxEvent(created as any);
    assert.strictEqual(publishResult, true, "Publish must return true");

    const publishedDoc = await OutboxEvent.findById(created._id);
    assert.strictEqual(
      publishedDoc?.status,
      "PUBLISHED",
      "Event status must be PUBLISHED after successful send",
    );
    assert.ok(
      publishedDoc?.publishedAt instanceof Date,
      "publishedAt timestamp must be populated",
    );
    assert.strictEqual(
      capturedEvents.length,
      1,
      "Message must be delivered to Kafka producer",
    );
    console.log("✓ Immediate publish and state transition verified.");

    // 3. Kafka Failure Handling and Backoff
    console.log("3. Testing failure handling when Kafka is unavailable...");
    const failingEvent = await createOutboxEvent("test.outbox.event", {
      orderId: "ord_fail",
    });

    // Simulate Kafka broker failure
    producer.send = (async () => {
      throw new Error("Kafka broker connection timeout (Simulated)");
    }) as any;

    const failedResult = await publishOutboxEvent(failingEvent as any);
    assert.strictEqual(
      failedResult,
      false,
      "Publish must return false on broker error",
    );

    const failedDoc = await OutboxEvent.findById(failingEvent._id);
    assert.strictEqual(
      failedDoc?.status,
      "PENDING",
      "Failed event must remain in PENDING status for sweeper retry",
    );
    assert.ok(
      failedDoc?.lastError?.includes("Simulated"),
      "lastError must record the broker exception",
    );
    assert.ok(
      failedDoc?.lockedUntil && failedDoc.lockedUntil > new Date(),
      "lockedUntil must enforce backoff delay",
    );
    console.log("✓ Failure recorded with retry backoff; zero event loss.");

    // 4. Atomic Lease Claiming across Concurrent Workers
    console.log("4. Testing atomic lease-locking against race conditions...");
    // Reset lockedUntil so it can be claimed
    await OutboxEvent.findByIdAndUpdate(failingEvent._id, {
      $set: { lockedUntil: new Date(Date.now() - 1000) },
    });

    // Simulate 2 parallel workers attempting to claim the same event concurrently
    const [workerAClaims, workerBClaims] = await Promise.all([
      claimPendingOutboxEvents(10, 30_000),
      claimPendingOutboxEvents(10, 30_000),
    ]);

    const totalClaimed = [...workerAClaims, ...workerBClaims].filter(
      (e) => e._id.toString() === failingEvent._id.toString(),
    );
    assert.strictEqual(
      totalClaimed.length,
      1,
      "Event must be claimed by exactly ONE worker under concurrency",
    );
    console.log("✓ Atomic lease locking prevents duplicate worker dispatch.");

    // 5. Sweeper Recovery once Kafka heals
    console.log("5. Testing resilient sweeper recovery once Kafka recovers...");
    // Restore working Kafka producer
    capturedEvents.length = 0;
    producer.send = (async (topic: string, message: any) => {
      capturedEvents.push({ topic, message });
    }) as any;

    // Reset lease to expired
    await OutboxEvent.findByIdAndUpdate(failingEvent._id, {
      $set: { lockedUntil: null, status: "PENDING" },
    });

    const recoveredCount = await sweepPendingOutboxEvents();
    assert.ok(
      recoveredCount >= 1,
      "Sweeper must recover and publish pending events",
    );

    const recoveredDoc = await OutboxEvent.findById(failingEvent._id);
    assert.strictEqual(
      recoveredDoc?.status,
      "PUBLISHED",
      "Recovered event must transition to PUBLISHED",
    );
    assert.strictEqual(
      capturedEvents.length,
      1,
      "Kafka must receive the recovered event",
    );
    console.log(
      "✓ Sweeper successfully recovered and published pending event.",
    );

    // 6. Cluster Sweeper Isolation & Leader Election Mutex
    console.log(
      "6. Testing cluster sweeper isolation across horizontal replicas...",
    );
    await createOutboxEvent("test.outbox.event", {
      orderId: "ord_cluster_test",
    });

    capturedEvents.length = 0;
    const worker1Id = "replica-pod-1:1234:aaa";
    const worker2Id = "replica-pod-2:5678:bbb";

    // Simulate two horizontal container replicas triggering a sweep at the exact same millisecond
    const [sweepResult1, sweepResult2] = await Promise.all([
      sweepPendingOutboxEvents(10, worker1Id),
      sweepPendingOutboxEvents(10, worker2Id),
    ]);

    // Exactly one replica should have executed the sweep as leader, while the other skipped
    const totalSwept = sweepResult1 + sweepResult2;
    assert.strictEqual(
      totalSwept,
      1,
      "Cluster leader lease must ensure exactly ONE replica executes sweep per cycle",
    );
    assert.ok(
      (sweepResult1 === 1 && sweepResult2 === 0) ||
        (sweepResult1 === 0 && sweepResult2 === 1),
      "One replica must lead and the other must gracefully skip",
    );
    assert.strictEqual(
      capturedEvents.length,
      1,
      "Exactly one Kafka message must be emitted, preventing duplicate stream dispatch",
    );
    console.log(
      "✓ Cluster sweeper isolation prevented duplicate sweep execution and duplicate Kafka dispatches.",
    );

    // 7. Distributed Leader Election Framework & Standby Failover
    console.log(
      "7. Testing DistributedLeaderElector singleton & standby failover...",
    );
    let podAPromotions = 0;
    let podADemotions = 0;
    let podBPromotions = 0;
    let podBDemotions = 0;

    const testLockKey = "order:outbox:sweeper:leader:framework_test";
    const electorA = new DistributedLeaderElector({
      client: redis.client,
      lockKey: testLockKey,
      candidateId: "order-pod-alpha",
      leaseTtlMs: 3000,
      heartbeatIntervalMs: 800,
      retryDelayMs: 400,
      onPromoted: () => {
        podAPromotions++;
      },
      onDemoted: () => {
        podADemotions++;
      },
    });

    const electorB = new DistributedLeaderElector({
      client: redis.client,
      lockKey: testLockKey,
      candidateId: "order-pod-beta",
      leaseTtlMs: 3000,
      heartbeatIntervalMs: 800,
      retryDelayMs: 400,
      onPromoted: () => {
        podBPromotions++;
      },
      onDemoted: () => {
        podBDemotions++;
      },
    });

    // Step A: Elector A starts and wins cluster leadership
    await electorA.start();
    assert.strictEqual(
      electorA.isCurrentLeader,
      true,
      "Pod Alpha must be elected leader",
    );
    assert.strictEqual(
      podAPromotions,
      1,
      "Pod Alpha must receive promotion event",
    );

    // Step B: Elector B starts and must enter standby follower mode
    await electorB.start();
    assert.strictEqual(
      electorB.isCurrentLeader,
      false,
      "Pod Beta must remain in standby mode",
    );
    assert.strictEqual(
      podBPromotions,
      0,
      "Pod Beta must NOT be promoted while Alpha leads",
    );
    console.log(
      "✓ Pod Alpha elected leader; Pod Beta isolated in standby mode.",
    );

    // Step C: Verify Redis reports Pod Alpha as active cluster leader
    const leaderAInfo = await electorA.getLeaderInfo();
    assert.strictEqual(leaderAInfo.isLeader, true);
    assert.strictEqual(leaderAInfo.leaderId, "order-pod-alpha");

    // Step D: Pod Alpha steps down / gracefully stops
    await electorA.stop();
    assert.strictEqual(
      electorA.isCurrentLeader,
      false,
      "Pod Alpha must relinquish leadership on stop",
    );
    assert.strictEqual(
      podADemotions,
      1,
      "Pod Alpha must receive demotion event",
    );

    // Step E: Pod Beta detects vacant leadership and promotes automatically
    const betaElected = await electorB.electNow();
    assert.strictEqual(
      betaElected,
      true,
      "Pod Beta must win election upon Alpha failover",
    );
    assert.strictEqual(
      electorB.isCurrentLeader,
      true,
      "Pod Beta is now the active leader",
    );
    assert.strictEqual(
      podBPromotions,
      1,
      "Pod Beta must receive promotion event",
    );
    console.log("✓ Pod Beta successfully promoted upon leader failover.");

    // Step F: Clean up Pod Beta
    await electorB.stop();
    assert.strictEqual(
      podBDemotions,
      1,
      "Pod Beta must receive demotion event",
    );

    // Cleanup
    await OutboxEvent.deleteMany({ topic: "test.outbox.event" });
    console.log("\n=======================================================");
    console.log(" All Transactional Outbox Invariant Tests Passed! ");
    console.log("=======================================================\n");
  } finally {
    producer.send = originalSend;
    await redis.close();
    await mongoose.disconnect();
  }
}

runOutboxTests().catch((err) => {
  console.error("❌ Transactional Outbox Test Failed:", err);
  process.exit(1);
});
