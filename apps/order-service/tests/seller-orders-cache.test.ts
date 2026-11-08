import assert from "node:assert/strict";
import { SingleFlightGroup, fetchSellerOrdersCoalesced } from "../src/cache/seller-orders-cache.js";

async function runSellerOrdersCacheTests() {
  console.log("==================================================");
  console.log("⚡ SingleFlight & Scatter-Gather Cache Test Suite");
  console.log("==================================================");

  // 1. SingleFlight Coalescing: Same key triggers query function only ONCE
  console.log("\n1. Testing SingleFlight coalescing under concurrent load...");
  const sf = new SingleFlightGroup();
  let dbCallCount = 0;

  const mockDbQuery = async () => {
    dbCallCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [{ id: "order-1", total: 100 }];
  };

  // Launch 5 concurrent calls simultaneously
  const results = await Promise.all([
    sf.do("seller_123:50", mockDbQuery),
    sf.do("seller_123:50", mockDbQuery),
    sf.do("seller_123:50", mockDbQuery),
    sf.do("seller_123:50", mockDbQuery),
    sf.do("seller_123:50", mockDbQuery),
  ]);

  assert.equal(dbCallCount, 1, `Expected DB query to be called exactly 1 time, called ${dbCallCount}`);
  assert.equal(results.length, 5);
  assert.deepEqual(results[0], [{ id: "order-1", total: 100 }]);
  assert.deepEqual(results[4], [{ id: "order-1", total: 100 }]);
  console.log("  ✓ 5 concurrent requests coalesced into 1 execution");

  // 2. Sequential execution after flight completes executes again
  console.log("\n2. Testing flight map cleanup after promise completion...");
  const secondResult = await sf.do("seller_123:50", mockDbQuery);
  assert.equal(dbCallCount, 2, "Expected new flight to be initiated after completion");
  assert.deepEqual(secondResult, [{ id: "order-1", total: 100 }]);
  console.log("  ✓ Completed flight removed from map; subsequent calls execute fresh");

  // 3. Different flight keys run independently
  console.log("\n3. Testing distinct flight keys isolation...");
  let callA = 0;
  let callB = 0;
  await Promise.all([
    sf.do("key_A", async () => {
      callA++;
      return "A";
    }),
    sf.do("key_B", async () => {
      callB++;
      return "B";
    }),
  ]);
  assert.equal(callA, 1);
  assert.equal(callB, 1);
  console.log("  ✓ Distinct keys run isolated executions");

  // 4. Error propagation & cleanup
  console.log("\n4. Testing error propagation and rejection cleanup...");
  let failCount = 0;
  const failingQuery = async () => {
    failCount++;
    throw new Error("DB Connection Timeout");
  };

  const rejections = await Promise.allSettled([
    sf.do("fail_key", failingQuery),
    sf.do("fail_key", failingQuery),
  ]);

  assert.equal(failCount, 1, "Failing DB query should only be invoked once for coalesced waiters");
  assert.equal(rejections[0].status, "rejected");
  assert.equal(rejections[1].status, "rejected");
  // Ensure we can retry immediately after rejection
  let retryCount = 0;
  const retryResult = await sf.do("fail_key", async () => {
    retryCount++;
    return "recovered";
  });
  assert.equal(retryResult, "recovered");
  assert.equal(retryCount, 1);
  console.log("  ✓ Rejection propagated to all waiters and key cleaned up for retries");

  // 5. End-to-end fetchSellerOrdersCoalesced fallback
  console.log("\n5. Testing fetchSellerOrdersCoalesced execution & fallback...");
  let serviceDbExecutions = 0;
  const orders = await fetchSellerOrdersCoalesced("seller_xyz", 20, async () => {
    serviceDbExecutions++;
    return [{ orderId: "ord_999", amount: 499 }];
  });
  assert.equal(serviceDbExecutions, 1);
  assert.deepEqual(orders, [{ orderId: "ord_999", amount: 499 }]);
  console.log("  ✓ fetchSellerOrdersCoalesced successfully returned database payload");

  console.log("\n==================================================");
  console.log("🎉 ALL SINGLEFLIGHT & CACHING INVARIANTS PASSED!");
  console.log("==================================================");

  const { redis } = await import("../src/utils/redis.js");
  await redis.client.quit().catch(() => {});
  process.exit(0);
}

runSellerOrdersCacheTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
