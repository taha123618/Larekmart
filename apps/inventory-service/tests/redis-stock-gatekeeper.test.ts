import assert from "node:assert/strict";
import {
  calculateClusterSlot,
  extractClusterHashTag,
  assertClusterSlotAlignment,
  CrossSlotValidationError,
  InvalidHashTagError,
  TENANT_WAREHOUSE_TAG_PATTERN,
} from "@repo/redis";
import { redisStockGatekeeper } from "../src/gatekeeper/redis-stock-gatekeeper.js";
import { redis } from "../src/utils/redis.js";

async function runRedisStockGatekeeperTests(): Promise<void> {
  console.log("==================================================");
  console.log("⚡ Redis Stock Gatekeeper Sharding & Stress Suite");
  console.log("==================================================");

  const testKey = {
    productId: 99901,
    variantId: "var_flash_01",
    warehouseId: "pk_khi_01",
    tenantId: "tenant_pk",
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 0: Deterministic Cluster Hash Tag Slot Alignment
    // -------------------------------------------------------------------------
    console.log("\n0. Testing Redis Cluster Hash Tag slot invariants...");
    const stockKey = redisStockGatekeeper.getStockKey(testKey);
    const claimKey = redisStockGatekeeper.getClaimKey("ref_slot_test", testKey);
    const lockKey = redisStockGatekeeper.getLockKey(testKey);

    assert.equal(
      stockKey,
      "stock:available:{tenant_pk:pk_khi_01}:99901:var_flash_01",
      "Stock key must adhere to blueprint: stock:available:{tenant:wh}:prod:var",
    );
    assert.equal(
      claimKey,
      "stock:claim:{tenant_pk:pk_khi_01}:ref_slot_test",
      "Claim key must share the exact hash tag {tenant:wh}",
    );

    const stockTag = extractClusterHashTag(stockKey);
    const claimTag = extractClusterHashTag(claimKey);
    const lockTag = extractClusterHashTag(lockKey);

    assert.equal(
      stockTag,
      "tenant_pk:pk_khi_01",
      "Stock tag must match {tenant:wh}",
    );
    assert.equal(
      claimTag,
      "tenant_pk:pk_khi_01",
      "Claim tag must match {tenant:wh}",
    );
    assert.equal(
      lockTag,
      "tenant_pk:pk_khi_01",
      "Lock tag must match {tenant:wh}",
    );

    const stockSlot = calculateClusterSlot(stockKey);
    const claimSlot = calculateClusterSlot(claimKey);
    const lockSlot = calculateClusterSlot(lockKey);

    assert.equal(
      stockSlot,
      claimSlot,
      "Stock key and Claim key MUST hash to the identical Redis cluster slot (preventing CROSSSLOT errors)",
    );
    assert.equal(
      stockSlot,
      lockSlot,
      "Stock key and Lock key MUST hash to the identical Redis cluster slot",
    );
    console.log(
      `  ✓ Hash Tag {tenant_pk:pk_khi_01} correctly pinned keys to slot #${stockSlot} across shards`,
    );

    // Also test single warehouse tag without tenantId -> defaults strictly to {larekmart:pk_khi_01}
    const singleWhKey = {
      productId: 9981,
      variantId: "var_002",
      warehouseId: "pk_khi_01",
    };
    const singleWhStockKey = redisStockGatekeeper.getStockKey(singleWhKey);
    assert.equal(
      singleWhStockKey,
      "stock:available:{larekmart:pk_khi_01}:9981:var_002",
      "Single warehouse key must format with default tenant as stock:available:{larekmart:pk_khi_01}:9981:var_002",
    );
    assert.equal(
      extractClusterHashTag(singleWhStockKey),
      "larekmart:pk_khi_01",
      "Hash tag must be extracted as larekmart:pk_khi_01",
    );
    assert.ok(
      TENANT_WAREHOUSE_TAG_PATTERN.test(
        extractClusterHashTag(singleWhStockKey)!,
      ),
      "Default tenant hash tag must satisfy structural {tenant_id:warehouse_id} convention",
    );
    console.log(
      "  ✓ Blueprint stock:available:{larekmart:pk_khi_01}:9981:var_002 verified",
    );

    // -------------------------------------------------------------------------
    // TEST 0B: Guardrails Against Cross-Slot & Invalid Tag Failures
    // -------------------------------------------------------------------------
    console.log(
      "\n0B. Testing CROSSSLOT & structural hash tag validation guards...",
    );
    const conflictingWhKey = {
      productId: 99901,
      variantId: "var_flash_01",
      warehouseId: "pk_lhr_02", // Different warehouse -> conflicting CRC16 slot
      tenantId: "tenant_pk",
    };
    const conflictingStockKey =
      redisStockGatekeeper.getStockKey(conflictingWhKey);

    assert.notEqual(
      calculateClusterSlot(stockKey),
      calculateClusterSlot(conflictingStockKey),
      "Keys with different warehouse tags must map to different cluster slots",
    );

    assert.throws(
      () => {
        assertClusterSlotAlignment([stockKey, conflictingStockKey]);
      },
      CrossSlotValidationError,
      "Evaluating keys from conflicting slots must throw CrossSlotValidationError",
    );
    console.log(
      "  ✓ CrossSlotValidationError properly thrown on mismatched slots",
    );

    // Test rejection of legacy keys like {productId}:{variantId}:{warehouseId}
    const legacyKey = "stock:available:{99901}:{var_flash_01}:{pk_khi_01}";
    assert.throws(
      () => {
        assertClusterSlotAlignment([legacyKey, claimKey]);
      },
      InvalidHashTagError,
      "Legacy multi-bracket keys must be rejected by structural validation",
    );
    console.log(
      "  ✓ InvalidHashTagError properly thrown on non-{tenant:wh} keys",
    );

    // -------------------------------------------------------------------------
    // TEST 1: Direct Set & Pre-check Claim Success
    // -------------------------------------------------------------------------
    console.log("\n1. Testing atomic pre-check and reservation claim...");
    await redisStockGatekeeper.setStockCounter(testKey, 10);

    const ref1 = "ref_test_001";
    const claimRes1 = await redisStockGatekeeper.precheckAndClaim({
      itemKey: testKey,
      quantity: 3,
      referenceId: ref1,
      claimTtlSeconds: 30,
    });

    assert.equal(
      claimRes1.success,
      true,
      "Claim must succeed when stock is available",
    );
    if (claimRes1.success) {
      assert.equal(claimRes1.remainingQuantity, 7, "Remaining stock must be 7");
    }

    // Verify claim token exists in Redis at sharded location
    const shardedClaimKey1 = redisStockGatekeeper.getClaimKey(ref1, testKey);
    const claimValue1 = await redis.client.get(shardedClaimKey1);
    assert.equal(claimValue1, "3", "Claim token must store claimed quantity");

    // Finalize claim
    await redisStockGatekeeper.finalizeClaim(ref1, testKey);
    const claimAfterFinalize = await redis.client.get(shardedClaimKey1);
    assert.equal(
      claimAfterFinalize,
      null,
      "Claim token must be deleted after finalization",
    );
    console.log("  ✓ Atomic claim and finalization succeeded");

    // -------------------------------------------------------------------------
    // TEST 2: Fast-Reject on Insufficient Stock (<1ms)
    // -------------------------------------------------------------------------
    console.log("\n2. Testing fast-reject on insufficient stock...");
    const ref2 = "ref_test_002";
    const claimRes2 = await redisStockGatekeeper.precheckAndClaim({
      itemKey: testKey,
      quantity: 15, // Requested 15, but only 7 remain
      referenceId: ref2,
    });

    assert.equal(
      claimRes2.success,
      false,
      "Must reject when quantity exceeds available",
    );
    if (!claimRes2.success && claimRes2.reason === "INSUFFICIENT_STOCK") {
      assert.equal(
        claimRes2.availableQuantity,
        7,
        "Must report accurate available quantity",
      );
    } else {
      assert.fail("Expected INSUFFICIENT_STOCK reason");
    }
    console.log("  ✓ Insufficient stock fast-rejected without database query");

    // -------------------------------------------------------------------------
    // TEST 3: Flash-Sale Race Condition (10 Concurrent Shoppers for 5 Units)
    // -------------------------------------------------------------------------
    console.log(
      "\n3. Testing high-concurrency flash-sale oversell prevention...",
    );
    await redisStockGatekeeper.setStockCounter(testKey, 5);

    const concurrentShoppers = 10;
    const promises = Array.from({ length: concurrentShoppers }, (_, idx) => {
      const shopperRef = `ref_shopper_${idx}_${Date.now()}`;
      return redisStockGatekeeper.precheckAndClaim({
        itemKey: testKey,
        quantity: 1,
        referenceId: shopperRef,
      });
    });

    const results = await Promise.all(promises);
    const successfulClaims = results.filter((r) => r.success);
    const rejectedClaims = results.filter((r) => !r.success);

    assert.equal(
      successfulClaims.length,
      5,
      "Exactly 5 winning shoppers must acquire stock",
    );
    assert.equal(
      rejectedClaims.length,
      5,
      "Exactly 5 shoppers must be rejected immediately",
    );

    // Verify counter in Redis is exactly 0
    const remainingInRedis = await redis.client.get(stockKey);
    assert.equal(
      remainingInRedis,
      "0",
      "Redis stock counter must reach exactly 0 with zero oversell",
    );
    console.log(
      "  ✓ Exactly 5/10 shoppers claimed stock; oversell strictly prevented (stock = 0)",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Compensation Rollback on Database Failure
    // -------------------------------------------------------------------------
    console.log("\n4. Testing compensation rollback upon database failure...");
    await redisStockGatekeeper.setStockCounter(testKey, 8);

    const failRef = "ref_db_fail_test";
    const claimRes4 = await redisStockGatekeeper.precheckAndClaim({
      itemKey: testKey,
      quantity: 4,
      referenceId: failRef,
    });
    assert.equal(claimRes4.success, true);
    let currentStock = await redis.client.get(stockKey);
    assert.equal(
      currentStock,
      "4",
      "Stock must be decremented to 4 after claim",
    );

    // Simulate DB failure and trigger rollback
    await redisStockGatekeeper.rollbackClaim({
      itemKey: testKey,
      referenceId: failRef,
      quantity: 4,
    });

    currentStock = await redis.client.get(stockKey);
    assert.equal(
      currentStock,
      "8",
      "Stock must be restored back to 8 after rollback",
    );
    const failClaimKey = redisStockGatekeeper.getClaimKey(failRef, testKey);
    const failClaimValue = await redis.client.get(failClaimKey);
    assert.equal(
      failClaimValue,
      null,
      "Claim token must be purged after rollback",
    );
    console.log(
      "  ✓ Compensation rollback restored stock and purged claim token",
    );

    // -------------------------------------------------------------------------
    // TEST 5: Increment Stock Counter on Expiry / Cancellation
    // -------------------------------------------------------------------------
    console.log(
      "\n5. Testing stock counter increment upon release or expiration...",
    );
    await redisStockGatekeeper.setStockCounter(testKey, 12);
    await redisStockGatekeeper.incrementStockCounter(testKey, 3);

    currentStock = await redis.client.get(stockKey);
    assert.equal(
      currentStock,
      "15",
      "Stock counter must increment from 12 to 15",
    );
    console.log("  ✓ Increment counter successfully restored released stock");

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    await redisStockGatekeeper.invalidateCounter(testKey);
    console.log("\n==================================================");
    console.log("🎉 All Redis Stock Gatekeeper Tests Passed Cleanly!");
    console.log("==================================================");
  } finally {
    await redis.close();
  }
}

runRedisStockGatekeeperTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
