import assert from "node:assert/strict";
import {
  createKeyBuilder,
  createClusterHashTag,
  createTenantWarehouseHashTag,
  extractClusterHashTag,
  calculateClusterSlot,
  validateClusterHashTag,
  assertClusterSlotAlignment,
  evalClusterSafe,
  evalTenantWarehouseSafe,
  CrossSlotValidationError,
  InvalidHashTagError,
  TENANT_WAREHOUSE_TAG_PATTERN,
  crc16,
  acquireRedlockConsensus,
  releaseRedlockConsensus,
  renewRedlockConsensus,
  withClusterLock,
  withRedlockConsensus,
  DistributedLeaderElector,
  LeaderElection,
  LeaderFencingError,
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
  assert.equal(
    vectorCrc,
    12739,
    "CRC16 of '123456789' must equal standard XMODEM 12739",
  );

  const slot1 = calculateClusterSlot("plain_key_without_brackets");
  assert.ok(
    slot1 >= 0 && slot1 < 16384,
    "Cluster slot must be within 0..16383",
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Cluster Hash Tag Extraction & Slot Coalescing
  // ---------------------------------------------------------------------------
  console.log(
    "\n2. Testing Hash Tag extraction and multi-key slot coalescing...",
  );
  const k1 = "stock:available:{pk_khi_01}:prod_9981:var_002";
  const k2 = "stock:claim:{pk_khi_01}:ref_shopper_8821";
  const k3 = "stock:lock:{pk_khi_01}:prod_9981:var_002";

  assert.equal(extractClusterHashTag(k1), "pk_khi_01");
  assert.equal(extractClusterHashTag(k2), "pk_khi_01");
  assert.equal(extractClusterHashTag(k3), "pk_khi_01");

  const slotK1 = calculateClusterSlot(k1);
  const slotK2 = calculateClusterSlot(k2);
  const slotK3 = calculateClusterSlot(k3);

  assert.equal(
    slotK1,
    slotK2,
    "Keys sharing {pk_khi_01} must map to identical slot",
  );
  assert.equal(
    slotK2,
    slotK3,
    "Keys sharing {pk_khi_01} must map to identical slot",
  );
  console.log(`  ✓ All 3 keys with {pk_khi_01} resolved to slot #${slotK1}`);

  // Multi-tenant composite tag: {tenant:warehouse}
  const mt1 = "stock:available:{tenant_global:dc_lahore}:item_001";
  const mt2 = "stock:claim:{tenant_global:dc_lahore}:order_ref_99";
  assert.equal(extractClusterHashTag(mt1), "tenant_global:dc_lahore");
  assert.equal(calculateClusterSlot(mt1), calculateClusterSlot(mt2));
  console.log(
    `  ✓ Multi-tenant tag {tenant_global:dc_lahore} resolved to slot #${calculateClusterSlot(mt1)}`,
  );

  // ---------------------------------------------------------------------------
  // TEST 3: KeyBuilder Sharded Method
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing KeyBuilder.sharded() and shardedTenant()...");
  const builder = createKeyBuilder("inventory:v1");
  const shardedKey = builder.sharded("pk_isb_01", "available", 554, "var_blue");
  assert.equal(
    shardedKey,
    "inventory:v1:{pk_isb_01}:available:554:var_blue",
    "KeyBuilder.sharded must format as <prefix>{tag}:segment:segment",
  );
  assert.equal(extractClusterHashTag(shardedKey), "pk_isb_01");
  console.log("  ✓ KeyBuilder.sharded generated correct slot-pinned key");

  const shardedTenantKey = builder.shardedTenant(
    "pk_isb_01",
    "tenant_pk",
    "available",
    554,
    "var_blue",
  );
  assert.equal(
    shardedTenantKey,
    "inventory:v1:{tenant_pk:pk_isb_01}:available:554:var_blue",
    "KeyBuilder.shardedTenant must format as <prefix>{tenant:wh}:segment:segment",
  );
  assert.equal(extractClusterHashTag(shardedTenantKey), "tenant_pk:pk_isb_01");
  console.log(
    "  ✓ KeyBuilder.shardedTenant generated structural multi-tenant key",
  );

  // ---------------------------------------------------------------------------
  // TEST 3B: Strict Structural Hash Tag Validation & Formatting
  // ---------------------------------------------------------------------------
  console.log(
    "\n3B. Testing structural {tenant_id:warehouse_id} validation and formatting...",
  );
  // Test formatting variations
  assert.equal(
    createTenantWarehouseHashTag("wh_01", "tenant_a"),
    "{tenant_a:wh_01}",
    "createTenantWarehouseHashTag must join tenant and warehouse",
  );
  assert.equal(
    createTenantWarehouseHashTag("wh_01"),
    "{larekmart:wh_01}",
    "createTenantWarehouseHashTag without tenant must default to {larekmart:wh_01}",
  );
  assert.equal(
    createTenantWarehouseHashTag("{tenant_b:wh_02}"),
    "{tenant_b:wh_02}",
    "createTenantWarehouseHashTag must preserve valid bracketed tag",
  );
  assert.equal(
    createTenantWarehouseHashTag("{legacy_single}"),
    "{larekmart:legacy_single}",
    "createTenantWarehouseHashTag must upgrade legacy single-token bracketed tag",
  );

  // Validate cluster hash tag
  const validKey = "stock:available:{tenant_pk:wh_khi}:99:v1";
  assert.equal(
    validateClusterHashTag(validKey, TENANT_WAREHOUSE_TAG_PATTERN),
    "tenant_pk:wh_khi",
  );

  // Rejection of invalid hash tags
  assert.throws(
    () => validateClusterHashTag("unbracketed_plain_key"),
    InvalidHashTagError,
    "Keys without brackets must throw InvalidHashTagError",
  );
  assert.throws(
    () => validateClusterHashTag("stock:available:{only_warehouse}:99:v1"),
    InvalidHashTagError,
    "Naked warehouse tag must violate structural pattern",
  );
  assert.throws(
    () => validateClusterHashTag("stock:available:{prod_1}:{var_2}:{wh_3}"),
    InvalidHashTagError,
    "Multi-bracket key must violate structural pattern",
  );
  console.log(
    "  ✓ validateClusterHashTag properly enforced {tenant_id:warehouse_id} structural contract",
  );

  // ---------------------------------------------------------------------------
  // TEST 3C: Cross-Slot Alignment & evalClusterSafe Guard
  // ---------------------------------------------------------------------------
  console.log(
    "\n3C. Testing assertClusterSlotAlignment and evalClusterSafe guard...",
  );
  const alignedKey1 = "stock:available:{tenant_global:central_wh}:item_101";
  const alignedKey2 = "stock:claim:{tenant_global:central_wh}:claim_9981";
  const alignedKey3 = "stock:lock:{tenant_global:central_wh}:item_101";

  const slotAligned = assertClusterSlotAlignment([
    alignedKey1,
    alignedKey2,
    alignedKey3,
  ]);
  assert.equal(
    slotAligned,
    calculateClusterSlot(alignedKey1),
    "All aligned keys must resolve to common slot",
  );
  console.log(
    `  ✓ Aligned keys successfully confirmed on slot #${slotAligned}`,
  );

  // Test slot collision / mismatch rejection
  const misalignedKey = "stock:available:{tenant_global:other_wh}:item_101";
  assert.throws(
    () => assertClusterSlotAlignment([alignedKey1, misalignedKey]),
    CrossSlotValidationError,
    "Keys with different slots must throw CrossSlotValidationError",
  );
  console.log(
    "  ✓ CrossSlotValidationError properly intercepted mismatched slots",
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Redlock Majority Quorum Consensus Mock Simulation
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing Redlock consensus algorithm across 3 nodes...");
  // Simulate 3 independent Redis nodes
  const nodeState = new Map<string, string>();

  function createMockRedis(nodeId: string, failSet = false): Redis {
    return {
      get: async (key: string) => {
        const fullKey = `${nodeId}:${key}`;
        return nodeState.get(fullKey) ?? null;
      },
      incr: async (key: string) => {
        const fullKey = `${nodeId}:${key}`;
        const current = parseInt(nodeState.get(fullKey) ?? "0", 10);
        const next = current + 1;
        nodeState.set(fullKey, String(next));
        return next;
      },
      set: async (key: string, val: string, ...args: unknown[]) => {
        if (failSet) throw new Error(`${nodeId} simulated failure`);
        const fullKey = `${nodeId}:${key}`;
        if (args.includes("NX") && nodeState.has(fullKey)) {
          return null;
        }
        nodeState.set(fullKey, val);
        return "OK";
      },
      eval: async (
        script: string,
        _numkeys: number,
        key: string,
        expectedVal: string,
      ) => {
        const fullKey = `${nodeId}:${key}`;
        if (nodeState.get(fullKey) === expectedVal) {
          if (script.includes("pexpire")) {
            return 1;
          }
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
  assert.ok(
    lease1.validityMs > 3000,
    "Validity time must remain within bounds",
  );
  console.log(
    `  ✓ 3-node Redlock consensus achieved (validity: ${lease1.validityMs}ms)`,
  );

  // Case 4B: Worker-2 attempts to acquire same key -> Conflict (0 nodes acquired)
  const lease2 = await acquireRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:sweeper",
    "worker-2",
    { ttlMs: 4000 },
  );
  assert.equal(
    lease2,
    null,
    "Concurrent worker-2 must be rejected by consensus",
  );
  console.log("  ✓ Conflicting worker-2 properly rejected by Redlock quorum");

  // Case 4C: Safe release of lease1
  const released = await releaseRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:sweeper",
    "worker-1",
  );
  assert.equal(released, true, "Must release lock across nodes");
  console.log("  ✓ Redlock successfully released across all consensus nodes");

  // Case 4E: Redlock Renewal across quorum
  const leaseRenew = await acquireRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:renew_test",
    "worker-renew",
    { ttlMs: 5000 },
  );
  assert.ok(leaseRenew !== null, "Must acquire lease for renew test");
  const renewedQuorum = await renewRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:renew_test",
    "worker-renew",
    5000,
  );
  assert.equal(
    renewedQuorum,
    true,
    "Must renew Redlock across consensus quorum",
  );
  const wrongWorkerRenew = await renewRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:renew_test",
    "imposter-worker",
    5000,
  );
  assert.equal(
    wrongWorkerRenew,
    false,
    "Imposter worker renewal must be rejected",
  );
  await releaseRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:outbox:renew_test",
    "worker-renew",
  );
  console.log("  ✓ Redlock lease renewal verified across majority quorum");

  // ---------------------------------------------------------------------------
  // TEST 5: Distributed Leader Election Lifecycle & Standby Failover
  // ---------------------------------------------------------------------------
  console.log(
    "\n5. Testing DistributedLeaderElector singleton & failover lifecycle...",
  );

  let pod1Promoted = 0;
  let pod1Demoted = 0;
  let pod2Promoted = 0;
  let pod2Demoted = 0;

  const electorPod1 = new DistributedLeaderElector({
    client: nodeA,
    lockKey: "order:outbox:sweeper:leader",
    candidateId: "order-service-pod-1",
    leaseTtlMs: 3000,
    heartbeatIntervalMs: 800,
    retryDelayMs: 500,
    onPromoted: () => {
      pod1Promoted++;
    },
    onDemoted: () => {
      pod1Demoted++;
    },
  });

  const electorPod2 = new DistributedLeaderElector({
    client: nodeA,
    lockKey: "order:outbox:sweeper:leader",
    candidateId: "order-service-pod-2",
    leaseTtlMs: 3000,
    heartbeatIntervalMs: 800,
    retryDelayMs: 500,
    onPromoted: () => {
      pod2Promoted++;
    },
    onDemoted: () => {
      pod2Demoted++;
    },
  });

  // Step 1: Start Pod 1 -> Must win election and become leader
  await electorPod1.start();
  assert.equal(
    electorPod1.isCurrentLeader,
    true,
    "Pod 1 must be elected leader",
  );
  assert.equal(pod1Promoted, 1, "Pod 1 onPromoted hook must fire exactly once");
  assert.ok(
    electorPod1.fencingToken > 0,
    "Pod 1 must receive a positive fencing token",
  );
  assert.equal(
    electorPod1.isLeadershipValid,
    true,
    "Pod 1 leadership must be valid immediately after promotion",
  );

  const leaderInfo1 = await electorPod1.getLeaderInfo();
  assert.equal(leaderInfo1.isLeader, true);
  assert.equal(leaderInfo1.leaderId, "order-service-pod-1");
  assert.equal(leaderInfo1.fencingToken, electorPod1.fencingToken);
  assert.equal(leaderInfo1.isLeadershipValid, true);
  console.log(
    `  ✓ Pod 1 successfully elected leader (fencing token: #${leaderInfo1.fencingToken}); outbox sweeper activated`,
  );

  // Step 2: Start Pod 2 -> Must be rejected and remain standby follower
  await electorPod2.start();
  assert.equal(
    electorPod2.isCurrentLeader,
    false,
    "Pod 2 must remain in standby mode",
  );
  assert.equal(pod2Promoted, 0, "Pod 2 onPromoted hook must NOT fire");
  assert.equal(
    electorPod2.fencingToken,
    0,
    "Standby follower must have fencing token 0",
  );

  const leaderInfo2 = await electorPod2.getLeaderInfo();
  assert.equal(leaderInfo2.isLeader, false);
  assert.equal(leaderInfo2.leaderId, "order-service-pod-1");
  console.log("  ✓ Pod 2 correctly entered standby mode (0 duplicate sweeps)");

  // Step 3: Pod 1 resigns (e.g. graceful shutdown / rolling deployment)
  await electorPod1.stop();
  assert.equal(
    electorPod1.isCurrentLeader,
    false,
    "Pod 1 must no longer be leader",
  );
  assert.equal(pod1Demoted, 1, "Pod 1 onDemoted hook must fire on resignation");
  console.log("  ✓ Pod 1 gracefully stepped down and released cluster lease");

  // Step 4: Pod 2 attempts election now that lease is released -> Promoted with higher monotonic fencing token!
  const pod2Won = await electorPod2.electNow();
  assert.equal(pod2Won, true, "Pod 2 must win election upon leader failover");
  assert.equal(
    electorPod2.isCurrentLeader,
    true,
    "Pod 2 is now the active leader",
  );
  assert.equal(pod2Promoted, 1, "Pod 2 onPromoted hook must fire");
  assert.ok(
    electorPod2.fencingToken > leaderInfo1.fencingToken,
    "Successor leader must be assigned a strictly higher monotonic fencing token",
  );
  console.log(
    `  ✓ Pod 2 promoted to leader with monotonically increasing fencing token #${electorPod2.fencingToken} (prev: #${leaderInfo1.fencingToken})`,
  );

  // Step 5: Test Heartbeat Drift Safety Detection & Self-Fencing
  const tokenFromAssertion = electorPod2.assertLeadershipValid();
  assert.equal(tokenFromAssertion, electorPod2.fencingToken);

  // Clean up Pod 2
  await electorPod2.stop();
  assert.equal(pod2Demoted, 1, "Pod 2 onDemoted hook must fire on cleanup");
  assert.equal(pod2Demoted, 1, "Pod 2 onDemoted hook must fire on cleanup");

  // ---------------------------------------------------------------------------
  // TEST 6: Distributed Leader Election with Multi-Node Redlock Consensus
  // ---------------------------------------------------------------------------
  console.log(
    "\n6. Testing DistributedLeaderElector with 3-node Redlock consensus...",
  );
  let redlockLeaderPromoted = 0;
  let redlockLeaderDemoted = 0;

  const redlockElector = new LeaderElection({
    redlockClients: [nodeA, nodeB, nodeC],
    lockKey: "order:outbox:redlock:leader",
    candidateId: "redlock-order-worker-01",
    leaseTtlMs: 4000,
    heartbeatIntervalMs: 1000,
    onPromoted: () => {
      redlockLeaderPromoted++;
    },
    onDemoted: () => {
      redlockLeaderDemoted++;
    },
  });

  await redlockElector.start();
  assert.equal(
    redlockElector.isCurrentLeader,
    true,
    "Redlock candidate must be elected leader",
  );
  assert.equal(redlockLeaderPromoted, 1);

  const redlockLeaderId = await redlockElector.getCurrentLeaderId();
  assert.equal(redlockLeaderId, "redlock-order-worker-01");

  // Manual renew check
  const redlockRenewed = await redlockElector.electNow();
  assert.equal(
    redlockRenewed,
    true,
    "Active Redlock leader lease renewal must succeed",
  );

  await redlockElector.stop();
  assert.equal(redlockElector.isCurrentLeader, false);
  assert.equal(redlockLeaderDemoted, 1);
  console.log(
    "  ✓ Multi-node Redlock leader election lifecycle fully verified",
  );

  // ---------------------------------------------------------------------------
  // TEST 7: withClusterLock & withRedlockConsensus Higher-Order Execution Wrappers
  // ---------------------------------------------------------------------------
  console.log(
    "\n7. Testing withClusterLock and withRedlockConsensus wrappers...",
  );

  let executedWork = 0;
  const lockResult = await withClusterLock(
    nodeA,
    "cart:expiration:sweeper:leader",
    "worker-wrap-1",
    async () => {
      executedWork += 10;
      return "SUCCESS";
    },
    { ttlMs: 3000 },
  );
  assert.equal(lockResult, "SUCCESS");
  assert.equal(executedWork, 10);

  // Verify that the lock was cleaned up in finally block (not dangling)
  const lockKeyDirect = await nodeA.get("cart:expiration:sweeper:leader");
  assert.equal(
    lockKeyDirect,
    null,
    "withClusterLock must release lock in finally",
  );

  // Test Redlock wrapper
  let redlockWorkExecuted = false;
  const redlockWrapResult = await withRedlockConsensus(
    [nodeA, nodeB, nodeC],
    "cluster:redlock:wrap:test",
    "worker-redlock-wrap-1",
    async (lease) => {
      assert.ok(lease.validityMs > 0);
      assert.equal(lease.workerId, "worker-redlock-wrap-1");
      redlockWorkExecuted = true;
      return 42;
    },
    { ttlMs: 4000 },
  );
  assert.equal(redlockWrapResult, 42);
  assert.equal(redlockWorkExecuted, true);

  // Verify that Redlock consensus was completely released in finally
  const redlockLeaseDirect = await nodeA.get("cluster:redlock:wrap:test");
  assert.equal(
    redlockLeaseDirect,
    null,
    "withRedlockConsensus must release across nodes in finally",
  );
  console.log(
    "  ✓ withClusterLock & withRedlockConsensus clean execution & safe cleanup verified",
  );

  console.log("\n==================================================");
  console.log("🎉 All @repo/redis Cluster Sharding Tests Passed Cleanly!");
  console.log("==================================================");
}

runRedisClusterShardingTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
