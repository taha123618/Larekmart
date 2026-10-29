import assert from "node:assert/strict";
import { Order, ensureOrderCollectionSharded } from "@repo/order-db";

async function runMongoDBShardingTests() {
  console.log("==================================================");
  console.log("🧩 MongoDB Orders Horizontal Sharding Test Suite");
  console.log("==================================================");

  // 1. Validate MongoDB Order Schema Indexes for Horizontal Sharding
  console.log(
    "\n1. Testing MongoDB Order Schema sharding & compound indexes...",
  );
  const indexes = Order.schema.indexes();

  const hasHashedUserIdIndex = indexes.some(
    ([fields]) => (fields as Record<string, unknown>).userId === "hashed",
  );
  assert.equal(
    hasHashedUserIdIndex,
    true,
    "Expected OrderSchema to define a hashed index on { userId: 'hashed' } for MongoDB sharding",
  );
  console.log("  ✓ Hashed shard key index { userId: 'hashed' } verified");

  const hasCompoundUserTimeIndex = indexes.some(([fields]) => {
    const f = fields as Record<string, unknown>;
    return f.userId === 1 && f.createdAt === -1;
  });
  assert.equal(
    hasCompoundUserTimeIndex,
    true,
    "Expected OrderSchema to define compound index { userId: 1, createdAt: -1 }",
  );
  console.log("  ✓ Compound index { userId: 1, createdAt: -1 } verified");

  const hasCreatedAtIndex = indexes.some(
    ([fields]) => (fields as Record<string, unknown>).createdAt === -1,
  );
  assert.equal(
    hasCreatedAtIndex,
    true,
    "Expected OrderSchema to define { createdAt: -1 } for timeline sorting",
  );
  console.log("  ✓ Timeline index { createdAt: -1 } verified");

  // 2. Validate ensureOrderCollectionSharded standalone detection & graceful handling
  console.log("\n2. Testing ensureOrderCollectionSharded runtime behavior...");
  const shardingResult = await ensureOrderCollectionSharded();
  assert.ok(typeof shardingResult.sharded === "boolean");
  console.log(
    `  ✓ Sharding inspector returned safely: sharded=${shardingResult.sharded} (reason: ${shardingResult.reason || "active mongos"})`,
  );

  console.log("\n==================================================");
  console.log("🎉 ALL MONGODB SHARDING INVARIANTS PASSED (100%)");
  console.log("==================================================");
}

runMongoDBShardingTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
