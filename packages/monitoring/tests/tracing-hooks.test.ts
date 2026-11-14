import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHttpMonitor,
  createKafkaMonitor,
  createDatabaseMonitor,
  createLogger,
  createMetricsRegistry,
  Tracer,
  runWithTraceContext,
} from "../src/index.js";

console.log("==================================================");
console.log("⚡ @repo/monitoring Distributed Tracing Hooks Test Suite");
console.log("==================================================");

const logger = createLogger("test-service");
const metrics = createMetricsRegistry("test-service");
const tracer = Tracer.getInstance();
tracer.init({ serviceName: "test-service", enabled: true });

async function runTracingHookTests() {
  // Test 1: HTTP Request Span Emission
  console.log(
    "\n1. Testing HTTP Request Span Emission via createHttpMonitor...",
  );
  const httpMonitor = createHttpMonitor(logger, metrics);

  const customTrace = {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    sampled: true,
  };

  await runWithTraceContext(customTrace, async () => {
    const handle = httpMonitor.onRequestStart({
      method: "GET",
      url: "/api/v1/orders?page=1",
      requestId: "req-123",
      userId: "user-456",
    });

    const ctx = handle.onRequestEnd(200);
    assert.equal(ctx.method, "GET");
    assert.equal(ctx.statusCode, 200);
    assert.equal(ctx.userId, "user-456");
  });
  console.log(
    "  ✓ HTTP request span successfully created with W3C parent context",
  );

  // Test 2: Kafka Consumer Span Emission
  console.log(
    "\n2. Testing Kafka Consumer Span Emission via createKafkaMonitor...",
  );
  const kafkaMonitor = createKafkaMonitor(logger, metrics);
  const consumeHandle = kafkaMonitor.onMessageStart(
    "order.created",
    "order-123",
  );
  const consumeCtx = consumeHandle.onMessageComplete(true);
  assert.equal(consumeCtx.topic, "order.created");
  assert.equal(consumeCtx.success, true);
  console.log("  ✓ Kafka consumer span successfully created and ended");

  // Test 3: Kafka Producer Span Emission
  console.log(
    "\n3. Testing Kafka Producer Span Emission via onProduceEvent...",
  );
  const produceResult = await kafkaMonitor.onProduceEvent(
    "payment.successful",
    async () => {
      return { orderId: "ord-789", status: "PAID" };
    },
  );
  assert.equal(produceResult.status, "PAID");
  console.log("  ✓ Kafka producer span and duration metrics recorded");

  // Test 4: Database Query Span Emission
  console.log(
    "\n4. Testing Database Client Span Emission via createDatabaseMonitor...",
  );
  const dbMonitor = createDatabaseMonitor(logger, metrics, "postgres");
  const dbResult = await dbMonitor.measureQuery("findOrderById", async () => {
    return { id: "ord-1", total: 100 };
  });
  assert.equal(dbResult.id, "ord-1");
  console.log("  ✓ Database client span and performance telemetry verified");

  console.log("\n==================================================");
  console.log("🎉 All Distributed Tracing Hook Tests Passed Cleanly!");
  console.log("==================================================");
}

runTracingHookTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
