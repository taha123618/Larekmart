import assert from "node:assert";
import type { Kafka, Producer, ProducerRecord } from "kafkajs";
import { parseKafkaHeaders } from "../src/dlq/inspector.js";
import { replayDeadLetter, replayDeadLettersBatch } from "../src/dlq/replayer.js";
import type { DeadLetterRecord } from "../src/dlq/types.js";

async function runDlqReplayerTests(): Promise<void> {
  console.log("==================================================");
  console.log("🛡️ Kafka DLQ Replayer & Graveyard Guard Test Suite");
  console.log("==================================================");

  const sentMessages: Array<{ topic: string; messages: any[] }> = [];

  const mockProducer: Producer = {
    connect: async () => {},
    disconnect: async () => {},
    send: async (record: ProducerRecord) => {
      sentMessages.push(record as any);
      return [];
    },
  } as unknown as Producer;

  const mockKafka: Kafka = {
    producer: () => mockProducer,
  } as unknown as Kafka;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Header Parsing
    // -------------------------------------------------------------------------
    console.log("\n1. Testing Kafka header parser...");
    const rawHeaders = {
      "x-original-topic": Buffer.from("order.created"),
      "x-consumer-group": "order-service-group",
      "x-attempt-count": Buffer.from("3"),
      "x-is-poison-pill": Buffer.from("true"),
      "x-empty-header": undefined,
    };

    const parsed = parseKafkaHeaders(rawHeaders);
    assert.strictEqual(parsed["x-original-topic"], "order.created");
    assert.strictEqual(parsed["x-consumer-group"], "order-service-group");
    assert.strictEqual(parsed["x-attempt-count"], "3");
    assert.strictEqual(parsed["x-is-poison-pill"], "true");
    assert.strictEqual(parsed["x-empty-header"], undefined);
    console.log("  ✓ Raw buffer and string headers parsed correctly");

    // -------------------------------------------------------------------------
    // TEST 2: Guarded Replay with Counter & Provenance Headers
    // -------------------------------------------------------------------------
    console.log("\n2. Testing guarded replay stamping provenance headers...");
    sentMessages.length = 0;

    const baseRecord: DeadLetterRecord = {
      id: "order.created.dlq-0-45",
      originalTopic: "order.created",
      dlqTopic: "order.created.dlq",
      partition: 0,
      offset: "45",
      key: "order-12345",
      rawPayload: JSON.stringify({ orderId: "order-12345", total: 100 }),
      errorMessage: "Database lock timeout",
      errorName: "DBLockError",
      errorStack: "DBLockError: timeout at ...",
      attemptCount: 3,
      isPoisonPill: false,
      consumerGroup: "order-service-group",
      failedAt: "2026-11-10T12:00:00.000Z",
      replayCount: 0,
      status: "PENDING",
    };

    const res1 = await replayDeadLetter(mockKafka, baseRecord, {
      recordId: baseRecord.id,
      dlqTopic: baseRecord.dlqTopic,
      partition: baseRecord.partition,
      offset: baseRecord.offset,
      replayedBy: "admin:taha",
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.targetTopic, "order.created");
    assert.strictEqual(res1.replayCount, 1);
    assert.strictEqual(res1.routedToGraveyard, false);
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0]);
    const replayedMsg = sentMessages[0].messages[0];
    assert.strictEqual(
      replayedMsg.headers["x-original-topic"],
      "order.created",
    );
    assert.strictEqual(replayedMsg.headers["x-larekmart-replay-count"], "1");
    assert.strictEqual(
      replayedMsg.headers["x-larekmart-replayed-by"],
      "admin:taha",
    );
    assert.strictEqual(
      replayedMsg.headers["x-larekmart-payload-modified"],
      "false",
    );
    console.log(
      "  ✓ Message republished to source topic with replay count = 1 and provenance headers",
    );

    // -------------------------------------------------------------------------
    // TEST 3: Fix-and-Replay with Modified Payload
    // -------------------------------------------------------------------------
    console.log("\n3. Testing Fix-and-Replay payload mutation...");
    sentMessages.length = 0;

    const fixedPayload = JSON.stringify({
      orderId: "order-12345",
      total: 100,
      status: "FIXED",
    });
    const res2 = await replayDeadLetter(mockKafka, baseRecord, {
      recordId: baseRecord.id,
      dlqTopic: baseRecord.dlqTopic,
      partition: baseRecord.partition,
      offset: baseRecord.offset,
      replayedBy: "admin:taha",
      modifiedPayload: fixedPayload,
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0]);
    const modifiedMsg = sentMessages[0].messages[0];
    assert.strictEqual(modifiedMsg.value.toString("utf-8"), fixedPayload);
    assert.strictEqual(
      modifiedMsg.headers["x-larekmart-payload-modified"],
      "true",
    );
    console.log(
      "  ✓ Sanitized payload replayed and tagged with x-larekmart-payload-modified: true",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Max Replay Threshold Loop Prevention (Graveyard Diversion)
    // -------------------------------------------------------------------------
    console.log(
      "\n4. Testing max replay threshold loop prevention (terminal graveyard diversion)...",
    );
    sentMessages.length = 0;

    const loopedRecord: DeadLetterRecord = {
      ...baseRecord,
      replayCount: 3, // Already failed 3 previous replays!
    };

    const res3 = await replayDeadLetter(mockKafka, loopedRecord, {
      recordId: loopedRecord.id,
      dlqTopic: loopedRecord.dlqTopic,
      partition: loopedRecord.partition,
      offset: loopedRecord.offset,
      replayedBy: "cli:operator",
      maxReplayThreshold: 3,
    });

    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.targetTopic, "order.created.dlq.parked");
    assert.strictEqual(res3.routedToGraveyard, true);
    assert.strictEqual(res3.replayCount, 4);

    assert.ok(sentMessages[0]);
    const graveyardMsg = sentMessages[0].messages[0];
    assert.strictEqual(
      graveyardMsg.headers["x-larekmart-parked-reason"],
      "EXCEEDED_MAX_REPLAY_THRESHOLD",
    );
    console.log(
      "  ✓ Repeat failure safely routed to order.created.dlq.parked graveyard topic",
    );

    // -------------------------------------------------------------------------
    // TEST 5: Batch Replay of Multiple Dead Letters
    // -------------------------------------------------------------------------
    console.log("\n5. Testing batch replay of multiple dead letters...");
    sentMessages.length = 0;

    const batchRecords: DeadLetterRecord[] = [
      {
        ...baseRecord,
        id: "order.created.dlq-0-46",
        offset: "46",
        replayCount: 0,
      },
      {
        ...baseRecord,
        id: "order.created.dlq-0-47",
        offset: "47",
        replayCount: 1,
      },
    ];

    const batchResults = await replayDeadLettersBatch(mockKafka, batchRecords, {
      replayedBy: "cli:batch-operator",
    });

    assert.strictEqual(batchResults.length, 2);
    assert.strictEqual(batchResults[0]?.success, true);
    assert.strictEqual(batchResults[0]?.replayCount, 1);
    assert.strictEqual(batchResults[1]?.success, true);
    assert.strictEqual(batchResults[1]?.replayCount, 2);
    assert.strictEqual(sentMessages.length, 2);
    console.log("  ✓ Batch replayer successfully replayed all records in single pass");

    console.log("\n==================================================");
    console.log("🎉 All DLQ Replayer & Graveyard Tests Passed Cleanly!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Test failure:", err);
    process.exit(1);
  }
}

runDlqReplayerTests();
