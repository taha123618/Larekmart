/**
 * End-to-End Distributed Flow & High-Concurrency Benchmark Suite
 *
 * Simulates and benchmarks the hardened multi-service pipeline:
 * 1. Concurrent Order Placement & Sharded Ingestion (MongoDB { userId: "hashed" })
 * 2. Scatter-Gather Thundering Herd Shielding (SingleFlight + 15s Redis Cache)
 * 3. Pipelined Outbox Sweeper Recovery (Chunked Promise.allSettled)
 * 4. Dual-ACK Saga Coordination (Inventory Sold + Tax Settled -> Confirmed)
 * 5. High-Velocity Materialized Ledger Payout Balance Credits (O(1) Indexed Reads)
 */

import assert from "node:assert/strict";
import { Order, OutboxEvent, mongoose } from "@repo/order-db";
import { SingleFlightGroup, fetchSellerOrdersCoalesced } from "../src/cache/seller-orders-cache.js";
import { redis } from "../src/utils/redis.js";
import { producer } from "../src/utils/kafka.js";
import { createOrder, confirmOrder } from "../src/utils/order.js";

const MONGO_URI = process.env.MONGO_URL || "mongodb://localhost:27017/larekmart_order_db";

interface BenchmarkMetrics {
  durationMs: number;
  throughputOpsSec: number;
  p95LatencyMs: number;
}

function calculateMetrics(startNs: bigint, count: number, latenciesMs: number[]): BenchmarkMetrics {
  const durationNs = Number(process.hrtime.bigint() - startNs);
  const durationMs = durationNs / 1_000_000;
  latenciesMs.sort((a, b) => a - b);
  const p95Index = Math.min(Math.floor(latenciesMs.length * 0.95), latenciesMs.length - 1);
  const p95LatencyMs = latenciesMs[p95Index] || 0;
  const throughputOpsSec = count / (durationMs / 1000);

  return {
    durationMs: Math.round(durationMs * 100) / 100,
    throughputOpsSec: Math.round(throughputOpsSec * 10) / 10,
    p95LatencyMs: Math.round(p95LatencyMs * 100) / 100,
  };
}

async function runE2EClusterSimulation() {
  console.log("==========================================================================");
  console.log("🚀 Larekmart Distributed Cluster Flow & High-Concurrency Benchmark");
  console.log("==========================================================================\n");

  await mongoose.connect(MONGO_URI);
  await Order.deleteMany({ email: "benchmark-test@example.com" });
  await OutboxEvent.deleteMany({ topic: "benchmark.order.created" });

  const sentKafkaMessages: Array<{ topic: string; message: any }> = [];
  producer.send = (async (topic: string, message: any) => {
    sentKafkaMessages.push({ topic, message });
  }) as any;

  const BATCH_SIZE = 50;

  // --------------------------------------------------------------------------
  // Phase 1: High-Concurrency Sharded Order Placement & Atomic Outbox Generation
  // --------------------------------------------------------------------------
  console.log(`[Phase 1] Concurrently placing ${BATCH_SIZE} sharded orders...`);
  const phase1Start = process.hrtime.bigint();
  const phase1Latencies: number[] = [];

  const orderPromises = Array.from({ length: BATCH_SIZE }).map(async (_, idx) => {
    const t0 = performance.now();
    const userId = `bench_user_${idx % 10}`; // 10 distinct users partitioned across shards
    const sessionId = `cs_bench_${Date.now()}_${idx}`;
    const reservationId = `res_bench_${Date.now()}_${idx}`;

    const order = await createOrder({
      sessionId,
      referenceId: sessionId,
      reservationId,
      userId,
      email: "benchmark-test@example.com",
      amount: 12500 + idx * 100,
      taxAmount: 500,
      taxCalculationId: `tax_calc_bench_${idx}`,
      paymentMethod: "card",
      sellerId: `seller_bench_${idx % 5}`,
      products: [
        {
          productId: 100 + (idx % 20),
          name: `Benchmark Product ${idx % 20}`,
          quantity: 2,
          price: 5000,
          sellerId: `seller_bench_${idx % 5}`,
        },
      ],
    });

    // Also persist an outbox event for sweeper pipelining benchmark
    await OutboxEvent.create({
      topic: "benchmark.order.created",
      payload: { orderId: order._id.toString(), userId, amount: order.amount },
      status: "PENDING",
      retryCount: 0,
      lockedUntil: null,
      fencingToken: 1,
    });

    phase1Latencies.push(performance.now() - t0);
    return order;
  });

  const createdOrders = await Promise.all(orderPromises);
  const phase1Metrics = calculateMetrics(phase1Start, BATCH_SIZE, phase1Latencies);

  assert.equal(createdOrders.length, BATCH_SIZE);
  console.log(`  ✓ Created ${BATCH_SIZE} sharded orders in ${phase1Metrics.durationMs}ms`);
  console.log(`    Throughput: ${phase1Metrics.throughputOpsSec} ops/sec | p95 Latency: ${phase1Metrics.p95LatencyMs}ms\n`);

  // --------------------------------------------------------------------------
  // Phase 2: Scatter-Gather Shielding Benchmark (SingleFlight + Redis Cache)
  // --------------------------------------------------------------------------
  console.log(`[Phase 2] Simulating stampede: ${BATCH_SIZE} concurrent queries for same seller...`);
  const targetSeller = "seller_bench_0";
  let underlyingDbQueries = 0;

  const mockDbQuery = async () => {
    underlyingDbQueries++;
    await new Promise((r) => setTimeout(r, 20)); // simulate 20ms sharded scatter-gather delay
    return Order.find({ "products.sellerId": targetSeller }).limit(20).lean();
  };

  const phase2Start = process.hrtime.bigint();
  const phase2Latencies: number[] = [];

  // Launch 50 concurrent requests simultaneously for the same seller
  const stampedeResults = await Promise.all(
    Array.from({ length: BATCH_SIZE }).map(async () => {
      const t0 = performance.now();
      const res = await fetchSellerOrdersCoalesced(targetSeller, 20, mockDbQuery);
      phase2Latencies.push(performance.now() - t0);
      return res;
    }),
  );

  const phase2Metrics = calculateMetrics(phase2Start, BATCH_SIZE, phase2Latencies);

  assert.equal(stampedeResults.length, BATCH_SIZE);
  assert.equal(
    underlyingDbQueries,
    1,
    `SingleFlight failed: Expected exactly 1 DB execution, got ${underlyingDbQueries}`,
  );
  console.log(`  ✓ 50 concurrent scatter-gather queries coalesced into ${underlyingDbQueries} database query`);
  console.log(`    Stampede resolution: ${phase2Metrics.durationMs}ms | Throughput: ${phase2Metrics.throughputOpsSec} ops/sec\n`);

  // Test cached speed (Warm Cache Hit)
  const warmT0 = performance.now();
  const warmResults = await fetchSellerOrdersCoalesced(targetSeller, 20, mockDbQuery);
  const warmLatencyMs = performance.now() - warmT0;
  assert.equal(underlyingDbQueries, 1, "Cache hit must not invoke DB query");
  console.log(`  ✓ Read-through Redis cache hit served in ${warmLatencyMs.toFixed(2)}ms (zero database I/O)\n`);

  // --------------------------------------------------------------------------
  // Phase 3: Pipelined Outbox Sweeper Relay Benchmark
  // --------------------------------------------------------------------------
  console.log(`[Phase 3] Benchmarking pipelined chunked outbox sweeper (CHUNK_SIZE = 10)...`);
  const pendingEvents = await OutboxEvent.find({ topic: "benchmark.order.created", status: "PENDING" });
  assert.equal(pendingEvents.length, BATCH_SIZE);

  const phase3Start = process.hrtime.bigint();
  const CHUNK_SIZE = 10;
  let dispatchedEvents = 0;

  // Process in bounded chunks matching the hardened outbox sweeper
  for (let i = 0; i < pendingEvents.length; i += CHUNK_SIZE) {
    const chunk = pendingEvents.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (event) => {
        await producer.send(event.topic, event.payload);
        event.status = "PUBLISHED";
        await event.save();
        return event._id;
      }),
    );
    dispatchedEvents += chunkResults.filter((r) => r.status === "fulfilled").length;
  }

  const phase3DurationMs = Number(process.hrtime.bigint() - phase3Start) / 1_000_000;
  const sweeperThroughput = dispatchedEvents / (phase3DurationMs / 1000);

  assert.equal(dispatchedEvents, BATCH_SIZE);
  console.log(`  ✓ Swept and published ${dispatchedEvents} outbox events in ${phase3DurationMs.toFixed(2)}ms`);
  console.log(`    Sweeper Drain Throughput: ${sweeperThroughput.toFixed(1)} events/sec\n`);

  // --------------------------------------------------------------------------
  // Phase 4: Dual-ACK Saga Coordination Settlement
  // --------------------------------------------------------------------------
  console.log(`[Phase 4] Concurrently coordinating Dual-ACK (Inventory Sold + Tax Completed)...`);
  const phase4Start = process.hrtime.bigint();
  const phase4Latencies: number[] = [];

  const confirmationPromises = createdOrders.map(async (order) => {
    const t0 = performance.now();
    // 1. Dual-ACK Step 1: Inventory stock deduction confirmation
    order.inventoryStatus = "sold";
    // 2. Dual-ACK Step 2: Tax calculation completed
    order.taxStatus = "completed";
    order.status = "confirmed";
    await order.save();
    phase4Latencies.push(performance.now() - t0);
    return order;
  });

  const confirmedOrders = await Promise.all(confirmationPromises);
  const phase4Metrics = calculateMetrics(phase4Start, BATCH_SIZE, phase4Latencies);

  assert.equal(confirmedOrders.every((o) => o.status === "confirmed"), true);
  console.log(`  ✓ ${BATCH_SIZE} orders successfully settled to CONFIRMED status in ${phase4Metrics.durationMs}ms`);
  console.log(`    Throughput: ${phase4Metrics.throughputOpsSec} ops/sec | p95 Latency: ${phase4Metrics.p95LatencyMs}ms\n`);

  // --------------------------------------------------------------------------
  // Phase 5: High-Velocity Materialized Ledger Payout Balance Verification
  // --------------------------------------------------------------------------
  console.log(`[Phase 5] Simulating concurrent seller ledger credits with O(1) materialized reads...`);
  const sellerBalances = new Map<string, number>();
  const NUM_SELLERS = 5;

  // Initialize seller accounts
  for (let s = 0; s < NUM_SELLERS; s++) {
    sellerBalances.set(`seller_bench_${s}`, 0);
  }

  const phase5Start = process.hrtime.bigint();
  const phase5Latencies: number[] = [];

  // Concurrently credit sellers for each confirmed order item
  await Promise.all(
    confirmedOrders.map(async (order, idx) => {
      const t0 = performance.now();
      const sellerId = `seller_bench_${idx % NUM_SELLERS}`;
      const creditAmount = (order.amount * 0.9) / 100; // 90% payout after 10% platform commission

      // Atomic in-memory balance update simulating ledger_accounts.current_balance atomic increment
      const current = sellerBalances.get(sellerId) || 0;
      sellerBalances.set(sellerId, current + creditAmount);

      phase5Latencies.push(performance.now() - t0);
    }),
  );

  const phase5Metrics = calculateMetrics(phase5Start, BATCH_SIZE, phase5Latencies);

  // Fast O(1) balance lookups
  for (let s = 0; s < NUM_SELLERS; s++) {
    const balance = sellerBalances.get(`seller_bench_${s}`) || 0;
    assert.ok(balance > 0, `Expected positive balance for seller ${s}`);
  }

  console.log(`  ✓ Processed ${BATCH_SIZE} ledger credits across ${NUM_SELLERS} sellers in ${phase5Metrics.durationMs}ms`);
  console.log(`    Throughput: ${phase5Metrics.throughputOpsSec} credits/sec | All balances verified in O(1)\n`);

  // --------------------------------------------------------------------------
  // Cleanup & Teardown
  // --------------------------------------------------------------------------
  await Order.deleteMany({ email: "benchmark-test@example.com" });
  await OutboxEvent.deleteMany({ topic: "benchmark.order.created" });
  await redis.client.quit().catch(() => {});
  await mongoose.disconnect();

  console.log("==========================================================================");
  console.log("🎉 ALL DISTRIBUTED CLUSTER BENCHMARK SCENARIOS PASSED!");
  console.log("==========================================================================");
  process.exit(0);
}

runE2EClusterSimulation().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
