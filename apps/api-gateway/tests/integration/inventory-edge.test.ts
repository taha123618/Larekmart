import assert from "node:assert";
import { buildApp } from "../../src/app.js";
import { redis } from "../../src/cache/redis.js";
import { cacheSet, cacheDel } from "@repo/redis";
import { buildStockCacheKey, type StockAvailabilityCache } from "@repo/types";

export async function runInventoryEdgeTests() {
  console.log("▶️ Running Inventory Edge Cache Integration Tests...");

  const app = await buildApp();

  try {
    const testProductId = "998877";
    const cacheKey = buildStockCacheKey(testProductId);

    // Seed mock data directly into Redis
    const seededPayload: StockAvailabilityCache = {
      productId: Number(testProductId),
      variantId: null,
      availableQuantity: 42,
      status: "IN_STOCK",
      updatedAt: new Date().toISOString(),
    };

    await cacheSet(redis.client, cacheKey, seededPayload, 60);

    // 1. Verify Cache Hit
    const hitResponse = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/${testProductId}/availability`,
    });

    assert.strictEqual(
      hitResponse.statusCode,
      200,
      "Cache hit must return 200 OK",
    );
    assert.strictEqual(
      hitResponse.headers["x-cache"],
      "HIT",
      "X-Cache header must be HIT",
    );
    const hitBody = JSON.parse(hitResponse.payload);
    assert.strictEqual(
      hitBody.availableQuantity,
      42,
      "Must return cached available quantity",
    );
    assert.strictEqual(
      hitBody.source,
      "edge-cache",
      "Source must indicate edge-cache",
    );
    console.log("  ✓ Edge stock cache hit verified from Redis");

    // Clean up test key
    await cacheDel(redis.client, cacheKey);

    // 2. Verify Cache Miss handling
    const missResponse = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/${testProductId}/availability`,
    });

    // Since inventory-service is not running during standalone test, gateway returns 503 gracefully
    assert.ok(
      missResponse.statusCode === 503 || missResponse.statusCode === 200,
      "Cache miss must either fetch upstream or return graceful 503",
    );
    console.log("  ✓ Edge stock cache miss degradation verified");

    console.log("✅ Inventory Edge Cache Integration Tests Passed!\n");
  } finally {
    await app.close();
  }
}
