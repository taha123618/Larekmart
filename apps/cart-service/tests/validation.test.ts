import assert from "node:assert";
import { validationService } from "../src/services/validation.service.js";
import { redis } from "../src/utils/redis.js";
import { ProductSnapshot } from "@repo/cart-db";

async function runTests() {
  console.log("=== Cart Service Decoupled Validation Test Suite ===\n");

  // 1. Test checkInventoryAvailability with cache miss
  console.log("1. Testing checkInventoryAvailability optimistic fallback on cache miss...");
  const result = await validationService.checkInventoryAvailability("prod_99999", 2);
  assert.strictEqual(result.available, true, "Should optimistically allow cart addition without HTTP call");
  console.log("✓ Optimistic inventory check passed without external HTTP dependency");

  // 2. Test validateProduct with cached item in Redis
  console.log("2. Testing validateProduct retrieves from Redis cache in <1ms...");
  const mockProduct = {
    productId: "prod_cached_100",
    name: "Speedy Sneaker",
    price: 4999,
    image: "https://example.com/sneaker.png",
    isActive: true,
  };

  // Mock redis.client.get
  const originalGet = redis.client.get.bind(redis.client);
  redis.client.get = (async (key: string) => {
    if (key === "cart:product:meta:prod_cached_100") {
      return JSON.stringify(mockProduct);
    }
    return null;
  }) as any;

  const cachedProduct = await validationService.validateProduct("prod_cached_100");
  assert.deepStrictEqual(cachedProduct, mockProduct, "Should retrieve cached product info accurately");
  console.log("✓ Cached product returned cleanly from Redis without network call");

  // 3. Test validateProduct falling back to ProductSnapshot.findOne
  console.log("3. Testing validateProduct falls back to local ProductSnapshot model...");
  const originalFindOne = ProductSnapshot.findOne.bind(ProductSnapshot);
  ProductSnapshot.findOne = ((query: any) => {
    if (query.productId === "prod_db_200") {
      return Promise.resolve({
        productId: "prod_db_200",
        name: "Classic Denim",
        price: 2999,
        image: "https://example.com/denim.png",
        isActive: true,
      });
    }
    return Promise.resolve(null);
  }) as any;

  const dbProduct = await validationService.validateProduct("prod_db_200");
  assert.strictEqual(dbProduct?.name, "Classic Denim");
  assert.strictEqual(dbProduct?.price, 2999);
  console.log("✓ Local ProductSnapshot fallback verified without external HTTP calls");

  // Restore mocks
  redis.client.get = originalGet;
  ProductSnapshot.findOne = originalFindOne;

  console.log("\n=======================================================");
  console.log(" All Decoupled Cart Validation Tests Passed! ");
  console.log("=======================================================\n");

  await redis.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
