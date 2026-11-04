import assert from "node:assert";
import type {
  Kafka,
  Consumer,
  Producer,
  EachBatchPayload,
  ProducerRecord,
  ConsumerRunConfig,
} from "kafkajs";
import { createConsumer, type KafkaBatchItem } from "../src/consumer.js";

async function runConsumerBatchTests(): Promise<void> {
  console.log("==================================================");
  console.log("🚀 Kafka Consumer High-Throughput Batch Test Suite");
  console.log("==================================================");

  let capturedEachBatch: ((payload: EachBatchPayload) => Promise<void>) | null =
    null;
  const sentDlqMessages: Array<{ topic: string; messages: any[] }> = [];

  const invokeBatch = async (payload: EachBatchPayload): Promise<void> => {
    if (!capturedEachBatch) {
      throw new Error("Consumer run eachBatch must be registered");
    }
    await capturedEachBatch(payload);
  };

  const mockProducer: Producer = {
    connect: async () => {},
    disconnect: async () => {},
    send: async (record: ProducerRecord) => {
      sentDlqMessages.push(record as any);
      return [];
    },
  } as unknown as Producer;

  const mockConsumer: Consumer = {
    connect: async () => {},
    disconnect: async () => {},
    subscribe: async () => {},
    run: async (config?: ConsumerRunConfig) => {
      capturedEachBatch = config?.eachBatch ?? null;
    },
  } as unknown as Consumer;

  const mockKafka: Kafka = {
    consumer: () => mockConsumer,
    producer: () => mockProducer,
  } as unknown as Kafka;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Happy Path Batch Processing
    // -------------------------------------------------------------------------
    console.log("\n1. Testing happy path batch processing...");
    const testTopic = "inventory.reservation.requested";
    let receivedBatch: KafkaBatchItem[] = [];
    const resolvedOffsets: string[] = [];
    let commitsCount = 0;
    let heartbeatsCount = 0;

    const consumer = createConsumer(mockKafka, "test-inventory-group", {
      initialRetryDelayMs: 10,
    });

    await consumer.subscribeBatch([
      {
        topicName: testTopic,
        batchSize: 50,
        topicHandler: async (batch) => {
          receivedBatch = batch;
        },
      },
    ]);

    assert.ok(capturedEachBatch, "Consumer run eachBatch must be registered");

    const sampleMessages = [
      {
        key: Buffer.from("sku_101"),
        value: Buffer.from(JSON.stringify({ sku: "sku_101", qty: 2 })),
        offset: "10",
        timestamp: "1793750000000",
        attributes: 0,
        headers: { "x-correlation-id": Buffer.from("corr_1") },
      },
      {
        key: Buffer.from("sku_102"),
        value: Buffer.from(JSON.stringify({ sku: "sku_102", qty: 1 })),
        offset: "11",
        timestamp: "1793750000001",
        attributes: 0,
        headers: {},
      },
    ];

    await invokeBatch({
      batch: {
        topic: testTopic,
        partition: 0,
        highWatermark: "100",
        messages: sampleMessages as any,
        isEmpty: () => false,
        firstOffset: () => "10",
        lastOffset: () => "11",
        offsetLag: () => "0",
        offsetLagLow: () => "0",
      },
      resolveOffset: (offset: string) => {
        resolvedOffsets.push(offset);
      },
      heartbeat: async () => {
        heartbeatsCount++;
      },
      commitOffsetsIfNecessary: async () => {
        commitsCount++;
      },
      uncommittedOffsets: () => ({ topics: [] }),
      isRunning: () => true,
      isStale: () => false,
      pause: () => () => {},
    });

    assert.equal(receivedBatch.length, 2, "Batch must contain 2 items");
    assert.deepEqual(receivedBatch[0]?.value, { sku: "sku_101", qty: 2 });
    assert.equal(receivedBatch[0]?.headers["x-correlation-id"], "corr_1");
    assert.deepEqual(resolvedOffsets, ["10", "11"], "Offsets must be resolved");
    assert.ok(commitsCount >= 1, "commitOffsetsIfNecessary must be called");
    console.log(
      "  ✓ Happy path batch delivered, parsed, and offsets committed",
    );

    // -------------------------------------------------------------------------
    // TEST 2: Chunking by batchSize with Heartbeats
    // -------------------------------------------------------------------------
    console.log("\n2. Testing batch chunking by configured batchSize...");
    const chunkInvocations: number[] = [];
    resolvedOffsets.length = 0;
    heartbeatsCount = 0;

    const chunkConsumer = createConsumer(mockKafka, "test-chunk-group", {
      initialRetryDelayMs: 10,
    });

    await chunkConsumer.subscribeBatch([
      {
        topicName: "chunk.test.topic",
        batchSize: 3,
        topicHandler: async (batch) => {
          chunkInvocations.push(batch.length);
        },
      },
    ]);

    const sevenMessages = Array.from({ length: 7 }, (_, i) => ({
      key: Buffer.from(`k_${i}`),
      value: Buffer.from(JSON.stringify({ id: i })),
      offset: String(20 + i),
      timestamp: String(Date.now()),
      attributes: 0,
      headers: {},
    }));

    await invokeBatch({
      batch: {
        topic: "chunk.test.topic",
        partition: 1,
        highWatermark: "200",
        messages: sevenMessages as any,
        isEmpty: () => false,
        firstOffset: () => "20",
        lastOffset: () => "26",
        offsetLag: () => "0",
        offsetLagLow: () => "0",
      },
      resolveOffset: (offset: string) => {
        resolvedOffsets.push(offset);
      },
      heartbeat: async () => {
        heartbeatsCount++;
      },
      commitOffsetsIfNecessary: async () => {},
      uncommittedOffsets: () => ({ topics: [] }),
      isRunning: () => true,
      isStale: () => false,
      pause: () => () => {},
    });

    assert.deepEqual(
      chunkInvocations,
      [3, 3, 1],
      "7 messages with batchSize 3 must chunk into [3, 3, 1]",
    );
    assert.equal(resolvedOffsets.length, 7, "All 7 offsets must be resolved");
    assert.ok(heartbeatsCount >= 3, "Heartbeat must be called per chunk");
    console.log("  ✓ Configured batchSize chunking and heartbeats verified");

    // -------------------------------------------------------------------------
    // TEST 3: Poison Pill Syntax Error Isolated within Batch
    // -------------------------------------------------------------------------
    console.log("\n3. Testing poison-pill isolation within a batch...");
    sentDlqMessages.length = 0;
    resolvedOffsets.length = 0;
    let deliveredToHandler: any[] = [];

    const poisonBatchConsumer = createConsumer(mockKafka, "test-poison-group", {
      initialRetryDelayMs: 10,
    });

    await poisonBatchConsumer.subscribeBatch([
      {
        topicName: "poison.batch.topic",
        batchSize: 10,
        topicHandler: async (batch) => {
          deliveredToHandler = batch.map((b) => b.value);
        },
      },
    ]);

    const mixedMessages = [
      {
        key: Buffer.from("msg_1"),
        value: Buffer.from(JSON.stringify({ valid: 1 })),
        offset: "100",
        timestamp: "1000",
        attributes: 0,
        headers: {},
      },
      {
        key: Buffer.from("msg_2_corrupt"),
        value: Buffer.from("NOT_VALID_JSON{{{"),
        offset: "101",
        timestamp: "1001",
        attributes: 0,
        headers: {},
      },
      {
        key: Buffer.from("msg_3"),
        value: Buffer.from(JSON.stringify({ valid: 3 })),
        offset: "102",
        timestamp: "1002",
        attributes: 0,
        headers: {},
      },
    ];

    await invokeBatch({
      batch: {
        topic: "poison.batch.topic",
        partition: 0,
        highWatermark: "150",
        messages: mixedMessages as any,
        isEmpty: () => false,
        firstOffset: () => "100",
        lastOffset: () => "102",
        offsetLag: () => "0",
        offsetLagLow: () => "0",
      },
      resolveOffset: (offset: string) => {
        resolvedOffsets.push(offset);
      },
      heartbeat: async () => {},
      commitOffsetsIfNecessary: async () => {},
      uncommittedOffsets: () => ({ topics: [] }),
      isRunning: () => true,
      isStale: () => false,
      pause: () => () => {},
    });

    assert.equal(
      sentDlqMessages.length,
      1,
      "Only the corrupt message must be sent to DLQ",
    );
    assert.equal(sentDlqMessages[0]?.topic, "poison.batch.topic.dlq");
    assert.equal(sentDlqMessages[0]?.messages[0]?.value, "NOT_VALID_JSON{{{");
    assert.deepEqual(
      deliveredToHandler,
      [{ valid: 1 }, { valid: 3 }],
      "Valid items must still be processed by the batch handler",
    );
    assert.deepEqual(
      resolvedOffsets,
      ["101", "100", "102"],
      "All offsets (including poison pill) must be resolved",
    );
    console.log(
      "  ✓ Poison pill isolated to DLQ without corrupting valid batch items",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Terminal Batch Failure Routes All Items to DLQ
    // -------------------------------------------------------------------------
    console.log("\n4. Testing terminal batch failure routing to DLQ...");
    sentDlqMessages.length = 0;
    resolvedOffsets.length = 0;

    const failingConsumer = createConsumer(mockKafka, "test-fail-group", {
      maxRetries: 2,
      initialRetryDelayMs: 10,
    });

    await failingConsumer.subscribeBatch([
      {
        topicName: "fail.batch.topic",
        batchSize: 10,
        topicHandler: async () => {
          throw new Error("Terminal DB deadlock");
        },
      },
    ]);

    const failingMessages = [
      {
        key: Buffer.from("f_1"),
        value: Buffer.from(JSON.stringify({ id: "f1" })),
        offset: "500",
        timestamp: "5000",
        attributes: 0,
        headers: {},
      },
      {
        key: Buffer.from("f_2"),
        value: Buffer.from(JSON.stringify({ id: "f2" })),
        offset: "501",
        timestamp: "5001",
        attributes: 0,
        headers: {},
      },
    ];

    await invokeBatch({
      batch: {
        topic: "fail.batch.topic",
        partition: 0,
        highWatermark: "600",
        messages: failingMessages as any,
        isEmpty: () => false,
        firstOffset: () => "500",
        lastOffset: () => "501",
        offsetLag: () => "0",
        offsetLagLow: () => "0",
      },
      resolveOffset: (offset: string) => {
        resolvedOffsets.push(offset);
      },
      heartbeat: async () => {},
      commitOffsetsIfNecessary: async () => {},
      uncommittedOffsets: () => ({ topics: [] }),
      isRunning: () => true,
      isStale: () => false,
      pause: () => () => {},
    });

    assert.equal(
      sentDlqMessages.length,
      2,
      "Both failing items must be forwarded to DLQ",
    );
    assert.deepEqual(
      resolvedOffsets,
      ["500", "501"],
      "Offsets must be resolved after DLQ forwarding",
    );
    console.log(
      "  ✓ Terminal batch failure safely forwarded all items to DLQ topic",
    );

    console.log("\n==================================================");
    console.log("🎉 All Kafka Consumer Batch Tests Passed Cleanly!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runConsumerBatchTests();
