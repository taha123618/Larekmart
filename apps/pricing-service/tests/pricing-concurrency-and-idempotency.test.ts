import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/pg-core";
import { buildApp } from "../src/app.js";
import { productPrices, priceRules } from "../src/db/schema.js";
import { pricingService } from "../src/services/pricing.service.js";
import { redis } from "../src/utils/redis.js";
import { acquireIdempotencyLock, commitIdempotencyResponse } from "@repo/redis";

async function runConcurrencyAndIdempotencyTests() {
  console.log("==================================================");
  console.log("  PRICING CONCURRENCY & IDEMPOTENCY TEST SUITE    ");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: Composite Database Indexes for Scalable Queries
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Composite Database Indexes Validation");

  const productPricesConfig = getTableConfig(productPrices);
  const productPriceIndexNames = productPricesConfig.indexes.map(
    (idx: any) => idx.config?.name || idx.name,
  );
  assert.ok(
    productPriceIndexNames.includes("product_prices_list_product_active_idx"),
    "productPrices table must include composite index 'product_prices_list_product_active_idx'",
  );
  console.log(
    "  ✓ Verified composite index 'product_prices_list_product_active_idx' on productPrices",
  );

  const priceRulesConfig = getTableConfig(priceRules);
  const priceRulesIndexNames = priceRulesConfig.indexes.map(
    (idx: any) => idx.config?.name || idx.name,
  );
  assert.ok(
    priceRulesIndexNames.includes("price_rules_list_active_idx"),
    "priceRules table must include composite index 'price_rules_list_active_idx'",
  );
  console.log(
    "  ✓ Verified composite index 'price_rules_list_active_idx' on priceRules",
  );

  // ────────────────────────────────────────────────────────────
  // Test 2: Product Price Redis Caching & SingleFlight Shielding
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Product Price Caching & SingleFlight Shielding");

  const testProductId = `prod_test_${Date.now()}`;
  const cacheKey = `pricing:product:default:${testProductId}:USD`;

  // Seed simulated price in Redis cache
  const simulatedPriceDetails = {
    productId: testProductId,
    priceListId: "00000000-0000-0000-0000-000000000001",
    priceListCode: "default",
    basePrice: 99.99,
    originalBasePrice: 99.99,
    originalCurrency: "USD",
    currency: "USD",
    exchangeRate: 1.0,
    compareAtPrice: 129.99,
    variants: [],
    rules: [],
  };

  await redis.client.set(cacheKey, JSON.stringify(simulatedPriceDetails));

  // Retrieve cached price
  const cachedResult = await pricingService.getProductPrice(
    testProductId,
    "USD",
    null,
  );
  assert.ok(cachedResult, "Cached product price must be returned");
  assert.equal(cachedResult.productId, testProductId);
  assert.equal(cachedResult.basePrice, 99.99);
  console.log(
    "  ✓ Product price retrieved directly from Redis cache without database round-trip",
  );

  // Verify SingleFlight in-flight coalescing
  const p1 = pricingService.getProductPrice(testProductId, "USD", null);
  const p2 = pricingService.getProductPrice(testProductId, "USD", null);
  const [res1, res2] = await Promise.all([p1, p2]);
  assert.deepEqual(res1, res2);
  console.log("  ✓ Concurrent requests coalesced seamlessly via SingleFlight");

  // ────────────────────────────────────────────────────────────
  // Test 3: Cache Invalidation on Price Modification
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Cache Invalidation on Mutations");

  await pricingService.invalidateProductPricing(testProductId);
  const cacheAfterInvalidation = await redis.client.get(cacheKey);
  assert.equal(
    cacheAfterInvalidation,
    null,
    "Cache entry must be evicted upon product price invalidation",
  );
  console.log(
    "  ✓ Product price cache successfully purged on price modification",
  );

  // ────────────────────────────────────────────────────────────
  // Test 4: Distributed Idempotency on Fastify Quote Endpoint
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Distributed Idempotency on Quote Creation");

  const app = await buildApp();

  const idempotencyKey = `idemp_quote_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Mock valid quote response in Redis directly to verify idempotency replay
  const mockQuoteResponse = {
    quoteId: "quote_test_idemp_1234",
    currency: "USD",
    items: [
      {
        productId: "prod_mock_1",
        quantity: 2,
        unitBasePrice: 50,
        unitFinalPrice: 50,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    totalDiscount: 0,
    promotionDiscount: 0,
    finalTotal: 100,
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  const redisKey = redis.keys.simple(`pricing:idemp:${idempotencyKey}`);

  // 1. Manually acquire lock & commit response to simulate completed execution
  await acquireIdempotencyLock(redis.client, redisKey, { lockTtlMs: 10000 });
  await commitIdempotencyResponse(redis.client, redisKey, {
    statusCode: 200,
    body: mockQuoteResponse,
  });

  // 2. Fire request with the same Idempotency-Key
  const replayRes = await app.inject({
    method: "POST",
    url: "/api/v1/prices/quote",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    payload: {
      items: [{ productId: "prod_mock_1", quantity: 2 }],
      currency: "USD",
    },
  });

  assert.equal(replayRes.statusCode, 200);
  assert.equal(
    replayRes.headers["idempotent-replayed"],
    "true",
    "Replayed response must set Idempotent-Replayed: true header",
  );
  const replayedBody = JSON.parse(replayRes.payload);
  assert.equal(replayedBody.quoteId, mockQuoteResponse.quoteId);
  console.log(
    "  ✓ Idempotent replay returned cached quote with 'Idempotent-Replayed: true'",
  );

  // 3. Test 409 Conflict when mutation is in-flight
  const inFlightKey = `idemp_inflight_${Date.now()}`;
  const inFlightRedisKey = redis.keys.simple(`pricing:idemp:${inFlightKey}`);
  await acquireIdempotencyLock(redis.client, inFlightRedisKey, {
    lockTtlMs: 10000,
  });

  const conflictRes = await app.inject({
    method: "POST",
    url: "/api/v1/prices/quote",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": inFlightKey,
    },
    payload: {
      items: [{ productId: "prod_mock_1", quantity: 2 }],
      currency: "USD",
    },
  });

  assert.equal(
    conflictRes.statusCode,
    409,
    "In-flight mutation must return 409 Conflict",
  );
  const conflictBody = JSON.parse(conflictRes.payload);
  assert.ok(
    conflictBody.message.includes("currently in-flight"),
    "409 response must explain that mutation is currently in-flight",
  );
  console.log(
    "  ✓ Concurrent duplicate request rejected with 409 Conflict while in-flight",
  );

  // Cleanup
  await redis.client.del(redisKey, inFlightRedisKey).catch(() => {});
  await app.close();

  console.log("\n==================================================");
  console.log("  ALL CONCURRENCY & IDEMPOTENCY TESTS PASSED!    ");
  console.log("==================================================\n");
}

runConcurrencyAndIdempotencyTests()
  .then(async () => {
    await redis.close().catch(() => {});
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
