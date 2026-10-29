import assert from "node:assert/strict";
import {
  createKeyBuilder,
  createClusterHashTag,
  extractClusterHashTag,
  calculateClusterSlot,
  crc16,
  acquireRedlockConsensus,
  releaseRedlockConsensus,
} from "../src/index.js";
import type { Redis } from "ioredis";

async function runRedisClusterShardingTests(): Promise<void> {
  console.log("==================================================");
  console.log("⚡ @repo/redis Cluster Sharding & Hash Tag Invariants");
  console.log("==================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: CRC16 Specification & Slot Allocation Invariants
  // ---------------------------------------------------------------------------
  console.log("\n1. Testing CRC16 and slot allocation...");
  // Standard test vector for XMODEM CRC16: "123456789" -> 0x31C3 (12739)
  const vectorCrc = crc16("123456789");
  assert.equal(vectorCrc, 12739, "CRC16 of '123456789' must equal standard XMODEM 12739");

  const slot1 = calculateClusterSlot("plain_key_without_brackets");
  assert.ok(slot1 >= 0 && slot1 < 16384, "Cluster slot must be within 0..16383");

  // ---------------------------------------------------------------------------
  // TEST 2: Cluster Hash Tag Extraction & Slot Coalescing
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing Hash Tag extraction and multi-key slot coalescing...");
  const k1 = "stock:available:{pk_khi_01}:prod_9981:var_002";
  const k2 = "stock:claim:{pk_khi_01}:ref_shopper_8821";
  const k3 = "stock:lock:{pk_khi_01}:prod_9981:var_002";

  assert.equal(extractClusterHashTag(k1), "pk_khi_01");
  assert.equal(extractClusterHashTag(k2), "pk_khi_01");
  assert.equal(extractClusterHashTag(k3), "pk_khi_01");

  const slotK1 = calculateClusterSlot(k1);
  const slotK2 = calculateClusterSlot(k2);
  const slotK3 = calculateClusterSlot(k3);

  assert.equal(slotK1, slotK2, "Keys sharing {pk_khi_01} must map to identical slot");
  assert.equal(slotK2, slotK3, "Keys sharing {pk_khi_01} must map to identical slot");
  console.log(`  ✓ All 3 keys with {pk_khi_01} resolved to slot #${slotK1}`);

  // Multi-tenant composite tag: {tenant:warehouse}
  const mt1 = "stock:available:{tenant_global:dc_lahore}:item_001";
  const mt2 = "stock:claim:{tenant_global:dc_lahore}:order_ref_99";
  assert.equal(extractClusterHashTag(mt1), "tenant_global:dc_lahore");
  assert.equal(calculateClusterSlot(mt1), calculateClusterSlot(mt2));
  console.log(`  ✓ Multi-tenant tag {tenant_global:dc_lahore} resolved to slot #${calculateClusterSlot(mt1)}`);

  // ---------------------------------------------------------------------------
  // TEST 3: KeyBuilder Sharded Method
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing KeyBuilder.sharded()...");
  const builder = createKeyBuilder("inventory:v1");
  const shardedKey = builder.sharded("pk_isb_01", "available", 554, "var_blue");
  assert.equal(
    shardedKey,
    "inventory:v1:{pk_isb_01}:available:554:var_blue",
    "KeyBuilder.sharded must format as <prefix>{tag}:segment:segment",
  );
  assert.equal(extractClusterHashTag(shardedKey), "pk_isb_01");
  console.log("  ✓ KeyBuilder.sharded generated correct slot-pinned key");

  // ---------------------------------------------------------------------------
  // TEST 4: Redlock Majority Quorum Consensus Mock Simulation
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing Redlock consensus algorithm across 3 nodes...");
  // Simulate 3 independent Redis nodes
  const nodeState = new Map<string, string>();

  function createMockRedis(nodeId: string, failSet = false): Redis {
    return {
      set: async (key: string, val: string, ...args: unknown[]) => {
        if (failSet) throw new Error(`${nodeId} simulated failure`);
        const fullKey = `${nodeId}:${key}`;
        if (args.includes("NX") && nodeState.has(fullKey)) {
          return null;
        }
        nodeState.set(fullKey, val);
        return "OK";
      },
      eval: async (_script: string, _numkeys: number, key: string, expectedVal: string) => {
        const fullKey = `${nodeId}:${key}`;
        if (nodeState.get(fullKey) === expectedVal) {
          nodeState.delete(fullKey);
          return 1;
        }
        return 0;
      },
    } as unknown as Redis;
  }

  const nodeA = createMockRedis("nodeA");
  const nodeB = createMockRedis("nodeB");
  const nodeC = createMockRedis("nodeC");

  // Case 4A: All 3 healthy nodes -> Quorum 2/3 achieved
  const lease1 = await acquireRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:sweeper",
    "worker-1",
    { ttlMs: 4000 },
  );
  assert.ok(lease1 !== null, "Must acquire lease when 3/3 nodes succeed");
  assert.equal(lease1.workerId, "worker-1");
  assert.ok(lease1.validityMs > 3000, "Validity time must remain within bounds");
  console.log(`  ✓ 3-node Redlock consensus achieved (validity: ${lease1.validityMs}ms)`);

  // Case 4B: Worker-2 attempts to acquire same key -> Conflict (0 nodes acquired)
  const lease2 = await acquireRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:sweeper",
    "worker-2",
    { ttlMs: 4000 },
  );
  assert.equal(lease2, null, "Concurrent worker-2 must be rejected by consensus");
  console.log("  ✓ Conflicting worker-2 properly rejected by Redlock quorum");

  // Case 4C: Safe release of lease1
  const released = await releaseRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:sweeper",
    "worker-1",
  );
  assert.equal(released, true, "Must release lock across nodes");
  console.log("  ✓ Redlock successfully released across all consensus nodes");

  // Case 4D: 1 node dead, 2 nodes healthy -> Quorum 2/3 still achieved (fault-tolerant!)
  const deadNode = createMockRedis("deadNode", true);
  const lease3 = await acquireRedlockConsensus(
    [nodeA, nodeB, deadNode],
    "cluster:outbox:sweeper",
    "worker-3",
    { ttlMs: 4000 },
  );
  assert.ok(lease3 !== null, "Must achieve quorum (2/3) even if 1 node crashes");
  assert.equal(lease3.workerId, "worker-3");
  await releaseRedlockConsensus([nodeA, nodeB, deadNode], "cluster:outbox:sweeper", "worker-3");
  console.log("  ✓ Redlock consensus successfully tolerated 1 crashed node (2/3 quorum)");

  console.log("\n==================================================");
  console.log("🎉 All @repo/redis Cluster Sharding Tests Passed Cleanly!");
  console.log("==================================================");
}

runRedisClusterShardingTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
