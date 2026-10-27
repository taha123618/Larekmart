import assert from "node:assert";
import type {
  Kafka,
  Consumer,
  Producer,
  EachMessagePayload,
  ProducerRecord,
  ConsumerRunConfig,
} from "kafkajs";
import { createConsumer } from "../src/consumer.js";

async function runConsumerDlqTests(): Promise<void> {
  console.log("==================================================");
  console.log("🛡️ Kafka Consumer DLQ & Poison-Pill Test Suite");
  console.log("==================================================");

  let capturedEachMessage:
    | ((payload: EachMessagePayload) => Promise<void>)
    | null = null;
  const sentDlqMessages: Array<{ topic: string; messages: any[] }> = [];

  const invokeMessage = async (payload: EachMessagePayload): Promise<void> => {
    if (!capturedEachMessage) {
      throw new Error("Consumer run eachMessage must be registered");
    }
    await capturedEachMessage(payload);
  };

  // Mock Producer
  const mockProducer: Producer = {
    connect: async () => {},
    disconnect: async () => {},
    send: async (record: ProducerRecord) => {
      sentDlqMessages.push(record as any);
      return [];
    },
  } as unknown as Producer;

  // Mock Consumer
  const mockConsumer: Consumer = {
    connect: async () => {},
    disconnect: async () => {},
    subscribe: async () => {},
    run: async (config?: ConsumerRunConfig) => {
      capturedEachMessage = config?.eachMessage ?? null;
    },
  } as unknown as Consumer;

  // Mock Kafka Client
  const mockKafka: Kafka = {
    consumer: () => mockConsumer,
    producer: () => mockProducer,
  } as unknown as Kafka;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Happy Path Execution (No Retries, No DLQ)
    // -------------------------------------------------------------------------
    console.log("\n1. Testing happy path message consumption...");
    let handlerInvocations = 0;
    const testTopic = "order.created";

    const consumer = createConsumer(mockKafka, "test-order-group", {
      initialRetryDelayMs: 10, // Short delay for test speed
    });

    await consumer.subscribe([
      {
        topicName: testTopic,
        topicHandler: async (msg: { orderId?: string }) => {
          handlerInvocations++;
          assert.equal(msg.orderId, "ord_123");
        },
      },
    ]);

    assert.ok(
      capturedEachMessage,
      "Consumer run eachMessage must be registered",
    );

    // Simulate incoming message
    await invokeMessage({
      topic: testTopic,
      partition: 0,
      message: {
        key: Buffer.from("key_1"),
        value: Buffer.from(JSON.stringify({ orderId: "ord_123" })),
        headers: {},
        offset: "100",
        attributes: 0,
        timestamp: String(Date.now()),
      },

      heartbeat: async () => {},
      pause: () => () => {},
    });

    assert.equal(handlerInvocations, 1, "Handler must be called once");
    assert.equal(
      sentDlqMessages.length,
      0,
      "No DLQ message should be dispatched on success",
    );
    console.log(
      "  ✓ Happy path processed with zero retries and zero DLQ dispatch",
    );

    // -------------------------------------------------------------------------
    // TEST 2: Transient Error with Successful Retry
    // -------------------------------------------------------------------------
    console.log(
      "\n2. Testing transient error with successful retry backoff...",
    );
    let transientAttempts = 0;
    const transientTopic = "payment.successful";

    const consumerTransient = createConsumer(mockKafka, "test-payment-group", {
      maxRetries: 3,
      initialRetryDelayMs: 20,
    });

    await consumerTransient.subscribe([
      {
        topicName: transientTopic,
        topicHandler: async () => {
          transientAttempts++;
          if (transientAttempts < 2) {
            throw new Error("Transient DB connection timeout");
          }
        },
      },
    ]);

    await invokeMessage({
      topic: transientTopic,
      partition: 1,
      message: {
        key: null,
        value: Buffer.from(JSON.stringify({ sessionId: "cs_test_123" })),
        headers: {},
        offset: "205",
        attributes: 0,
        timestamp: String(Date.now()),
      },
      heartbeat: async () => {},
      pause: () => () => {},
    });

    assert.equal(
      transientAttempts,
      2,
      "Handler must retry and succeed on attempt 2",
    );
    assert.equal(
      sentDlqMessages.length,
      0,
      "No DLQ message should be dispatched on recovery",
    );
    console.log("  ✓ Transient failure recovered on attempt 2; offset cleared");

    // -------------------------------------------------------------------------
    // TEST 3: Terminal Failure Exhausting Retries -> Forwarded to DLQ
    // -------------------------------------------------------------------------
    console.log(
      "\n3. Testing terminal failure exceeding maxRetries routing to DLQ...",
    );
    let terminalAttempts = 0;
    const terminalTopic = "shipping.shipped";

    const consumerTerminal = createConsumer(mockKafka, "test-shipping-group", {
      maxRetries: 3,
      initialRetryDelayMs: 15,
      dlqTopicSuffix: ".dlq",
    });

    await consumerTerminal.subscribe([
      {
        topicName: terminalTopic,
        topicHandler: async () => {
          terminalAttempts++;
          throw new Error("Downstream service permanently unavailable");
        },
      },
    ]);

    await invokeMessage({
      topic: terminalTopic,
      partition: 2,
      message: {
        key: Buffer.from("ship_001"),
        value: Buffer.from(JSON.stringify({ shipmentId: "ship_001" })),
        headers: {},
        offset: "340",
        attributes: 0,
        timestamp: String(Date.now()),
      },
      heartbeat: async () => {},
      pause: () => () => {},
    });

    assert.equal(
      terminalAttempts,
      3,
      "Handler must retry up to maxRetries (3)",
    );
    assert.equal(
      sentDlqMessages.length,
      1,
      "Exactly one DLQ message must be emitted",
    );

    const dlqRecord = sentDlqMessages[0]!;
    assert.equal(
      dlqRecord.topic,
      "shipping.shipped.dlq",
      "Must route to topic.dlq",
    );
    assert.equal(
      dlqRecord.messages[0].headers["x-original-topic"],
      "shipping.shipped",
    );
    assert.equal(dlqRecord.messages[0].headers["x-attempt-count"], "3");
    assert.equal(dlqRecord.messages[0].headers["x-is-poison-pill"], "false");
    assert.equal(
      dlqRecord.messages[0].headers["x-error-message"],
      "Downstream service permanently unavailable",
    );
    console.log(
      "  ✓ Terminal failure exhausted 3 retries and dispatched to shipping.shipped.dlq",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Poison-Pill Isolation (Malformed JSON Payload)
    // -------------------------------------------------------------------------
    console.log(
      "\n4. Testing poison-pill fast-fail on malformed JSON payload...",
    );
    sentDlqMessages.length = 0; // Clear
    let poisonHandlerCalled = false;
    const poisonTopic = "catalog.product.indexed";

    const consumerPoison = createConsumer(mockKafka, "test-catalog-group", {
      maxRetries: 3,
      initialRetryDelayMs: 20,
    });

    await consumerPoison.subscribe([
      {
        topicName: poisonTopic,
        topicHandler: async () => {
          poisonHandlerCalled = true;
        },
      },
    ]);

    // Send corrupted non-JSON payload
    await invokeMessage({
      topic: poisonTopic,
      partition: 0,
      message: {
        key: null,
        value: Buffer.from("{ malformed-corrupted-json-payload-not-closed"),
        headers: {},
        offset: "499",
        attributes: 0,
        timestamp: String(Date.now()),
      },
      heartbeat: async () => {},
      pause: () => () => {},
    });

    assert.equal(
      poisonHandlerCalled,
      false,
      "Handler must never be called for corrupted JSON payload",
    );
    assert.equal(
      sentDlqMessages.length,
      1,
      "Poison pill must be routed to DLQ immediately",
    );

    const poisonDlq = sentDlqMessages[0]!;
    assert.equal(poisonDlq.topic, "catalog.product.indexed.dlq");
    assert.equal(poisonDlq.messages[0].headers["x-attempt-count"], "1");
    assert.equal(poisonDlq.messages[0].headers["x-is-poison-pill"], "true");
    assert.equal(poisonDlq.messages[0].headers["x-error-name"], "SyntaxError");
    console.log(
      "  ✓ Poison pill fast-failed on attempt 1 directly to DLQ without stalling partition",
    );

    // -------------------------------------------------------------------------
    // TEST 5: Deterministic Schema Validation Poison-Pill
    // -------------------------------------------------------------------------
    console.log(
      "\n5. Testing deterministic schema decode error bypasses retries...",
    );
    sentDlqMessages.length = 0;
    let schemaAttempts = 0;
    const schemaTopic = "tax.calculation.completed";

    const consumerSchema = createConsumer(mockKafka, "test-tax-group", {
      maxRetries: 3,
      initialRetryDelayMs: 20,
    });

    await consumerSchema.subscribe([
      {
        topicName: schemaTopic,
        topicHandler: async () => {
          schemaAttempts++;
          const zodErr = new Error("Invalid schema fields");
          zodErr.name = "ZodError";
          throw zodErr;
        },
      },
    ]);

    await invokeMessage({
      topic: schemaTopic,
      partition: 1,
      message: {
        key: null,
        value: Buffer.from(JSON.stringify({ invalid: true })),
        headers: {},
        offset: "777",
        attributes: 0,
        timestamp: String(Date.now()),
      },
      heartbeat: async () => {},
      pause: () => () => {},
    });

    assert.equal(schemaAttempts, 1, "Deterministic ZodError must skip retries");
    assert.equal(
      sentDlqMessages.length,
      1,
      "Schema failure must route to DLQ immediately",
    );
    assert.equal(
      sentDlqMessages[0]!.messages[0].headers["x-error-name"],
      "ZodError",
    );
    assert.equal(
      sentDlqMessages[0]!.messages[0].headers["x-is-poison-pill"],
      "true",
    );
    console.log(
      "  ✓ Schema validation failure classified as poison pill; retries bypassed",
    );

    console.log("\n==================================================");
    console.log("🎉 All Kafka Consumer DLQ & Poison-Pill Tests Passed!");
    console.log("==================================================");
  } finally {
  }
}

runConsumerDlqTests().catch((err: unknown) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
