/**
 * Larekmart MongoDB Initialization Script
 * Reference: https://hub.docker.com/_/mongo
 *
 * Automatically executed on first container startup by the mongo entrypoint
 * for scripts mounted in /docker-entrypoint-initdb.d/
 */

print("Initializing Larekmart MongoDB databases and collections...");

// 1. Order Service Database
const orderDb = db.getSiblingDB("order_db");
orderDb.createUser({
  user: "order_user",
  pwd: "order_password",
  roles: [{ role: "readWrite", db: "order_db" }],
});

orderDb.createCollection("orders");
// Create horizontal sharding and compound indexes for hyperscale performance
orderDb.orders.createIndex({ userId: "hashed" });
orderDb.orders.createIndex({ userId: 1, createdAt: -1 });
orderDb.orders.createIndex({ paymentSessionId: 1 }, { sparse: true });
print("Created 'orders' collection and sharding indexes in 'order_db'.");

// Enable sharding if executing inside a sharded cluster (mongos)
try {
  sh.enableSharding("order_db");
  sh.shardCollection("order_db.orders", { userId: "hashed" });
  print(
    "Enabled horizontal sharding on order_db.orders with { userId: 'hashed' }.",
  );
} catch (shardingErr) {
  print(
    "Standalone or single-node replica set detected; sharding skipped, indexes configured.",
  );
}

// 2. Cart Service Database
const cartDb = db.getSiblingDB("cart_db");
cartDb.createCollection("carts");
cartDb.createCollection("processedevents");

print("Created 'carts' and 'processedevents' collections in 'cart_db'.");

// 3. Local Development Database Aliases
const devOrderDb = db.getSiblingDB("larekmart_order_db");
devOrderDb.createCollection("orders");

const devCartDb = db.getSiblingDB("larekmart_cart_db");
devCartDb.createCollection("carts");

print("Larekmart MongoDB database provisioning completed successfully.");
