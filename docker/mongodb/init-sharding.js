/**
 * Larekmart MongoDB Sharding Initialization Script
 *
 * Configures horizontal collection sharding for the orders database.
 * Uses a hashed shard key on `userId` to distribute write I/O evenly
 * across all shards during flash sales and isolate user order history queries.
 */

print("Initializing Larekmart MongoDB Sharding...");

// 1. Enable sharding on the order database
try {
  sh.enableSharding("order_db");
  print("Enabled sharding on database: order_db");
} catch (e) {
  print("Notice enabling sharding on order_db: " + e.message);
}

try {
  sh.enableSharding("larekmart_orders");
  print("Enabled sharding on database: larekmart_orders");
} catch (e) {
  print("Notice enabling sharding on larekmart_orders: " + e.message);
}

// 2. Shard the orders collections with hashed userId shard key
// Hashed shard keys distribute writes uniformly and prevent monotonic hotspots.
try {
  sh.shardCollection("order_db.orders", { userId: "hashed" });
  print("Successfully sharded order_db.orders with key: { userId: 'hashed' }");
} catch (e) {
  print("Notice sharding order_db.orders: " + e.message);
}

try {
  sh.shardCollection("larekmart_orders.orders", { userId: "hashed" });
  print(
    "Successfully sharded larekmart_orders.orders with key: { userId: 'hashed' }",
  );
} catch (e) {
  print("Notice sharding larekmart_orders.orders: " + e.message);
}

print("MongoDB sharding configuration completed.");
