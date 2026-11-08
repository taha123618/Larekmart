import assert from "node:assert";
import { getTopicPartitionCount } from "../src/init-topics.js";

console.log("=== Kafka Tiered Partitioning Test Suite ===\n");

// 1. Tier 1: Transactional / Sagas (16 partitions)
console.log("1. Testing Tier 1 Transactional & Saga topic partition allocations...");
assert.strictEqual(getTopicPartitionCount("order.created"), 16);
assert.strictEqual(getTopicPartitionCount("payment.successful"), 16);
assert.strictEqual(getTopicPartitionCount("inventory.reservation.requested"), 16);
assert.strictEqual(getTopicPartitionCount("inventory.stock.sold"), 16);
console.log("✓ Tier 1 topics correctly allocated 16 partitions for maximum consumer parallelism");

// 2. Tier 2: Telemetry / Behavioral (16 partitions)
console.log("2. Testing Tier 2 High-Velocity Telemetry partition allocations...");
assert.strictEqual(getTopicPartitionCount("product.viewed"), 16);
assert.strictEqual(getTopicPartitionCount("product.added_to_cart"), 16);
assert.strictEqual(getTopicPartitionCount("recommendation.interaction"), 16);
console.log("✓ Tier 2 clickstream topics allocated 16 partitions");

// 3. Tier 3: Operational Catalog & Cart (8 partitions)
console.log("3. Testing Tier 3 Operational topics partition allocations...");
assert.strictEqual(getTopicPartitionCount("product.updated"), 8);
assert.strictEqual(getTopicPartitionCount("cart.item_added"), 8);
assert.strictEqual(getTopicPartitionCount("pricing.price.updated"), 8);
console.log("✓ Tier 3 operational topics allocated 8 partitions");

// 4. Tier 4: Low-Velocity Administrative (4 partitions)
console.log("4. Testing Tier 4 Low-Velocity Administrative topics partition allocations...");
assert.strictEqual(getTopicPartitionCount("category.created"), 4);
assert.strictEqual(getTopicPartitionCount("tax.rate.updated"), 4);
assert.strictEqual(getTopicPartitionCount("vendor.profile.updated"), 4);
console.log("✓ Tier 4 admin topics allocated 4 partitions");

console.log("\n=======================================================");
console.log(" All Kafka Tiered Partitioning Tests Passed! ");
console.log("=======================================================\n");
