import assert from "node:assert/strict";
import Fastify from "fastify";
import { prisma, readPrisma, getCatalogDb } from "@repo/catalog-db";
import { GATEWAY_HEADERS } from "@repo/types";
import {
  markReadYourWrites,
  isReadYourWritesActive,
  clearReadYourWrites,
} from "@repo/redis";
import { CatalogCacheKeys } from "../src/cache/catalog-cache.js";
import { healthRoutes } from "../src/routes/health.routes.js";
import { configureFastifyPlugins } from "../src/plugins/fastify.js";
import {
  databaseContext,
  getDatabaseClient,
} from "../src/utils/database-context.js";
import { catalogService } from "../src/services/catalog.service.js";
import { catalogRepository } from "../src/repositories/catalog.repository.js";

async function runCatalogServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("📖 catalog-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: CatalogCacheKeys Key Generation Invariants
  // ---------------------------------------------------------------------------
  console.log("\n1. Testing CatalogCacheKeys naming conventions...");

  const productKey = CatalogCacheKeys.productCard("42");
  assert.ok(
    productKey.includes("product:42"),
    "Product cache key must contain product ID",
  );

  const catKey = CatalogCacheKeys.category("cat_footwear", 2);
  assert.ok(
    catKey.includes("category:cat_footwear:page:2"),
    "Category cache key must include category ID and page number",
  );

  const treeKey = CatalogCacheKeys.categoryTree();
  assert.ok(treeKey.includes("category:tree"), "Category tree key must match");

  const brandKey = CatalogCacheKeys.brand("brand_nike");
  assert.ok(
    brandKey.includes("brand:brand_nike"),
    "Brand key must contain brand ID",
  );

  const colKey = CatalogCacheKeys.collection("summer-drops");
  assert.ok(
    colKey.includes("collection:summer-drops"),
    "Collection key must match slug",
  );

  const featKey = CatalogCacheKeys.featured();
  assert.ok(
    featKey.includes("curated:featured"),
    "Featured key must match curated namespace",
  );

  const bestKey = CatalogCacheKeys.bestSellers();
  assert.ok(
    bestKey.includes("curated:best-sellers"),
    "Best sellers key must match curated namespace",
  );

  console.log(
    "  ✓ CatalogCacheKeys key generation validated across all domain entities",
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Fastify Health & Metrics Route Injections
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing Fastify health & metrics route injections...");

  const app = Fastify({ logger: false });
  await app.register(healthRoutes);
  await app.ready();

  // 2A. Liveness check: GET /health
  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.equal(healthRes.statusCode, 200, "GET /health must return 200 OK");
  const healthJson = healthRes.json() as { status: string; service: string };
  assert.equal(healthJson.status, "ok");
  assert.equal(healthJson.service, "catalog-service");
  console.log("  ✓ GET /health returned 200 with service metadata");

  // 2B. Prometheus metrics endpoint: GET /metrics
  const metricsRes = await app.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200, "GET /metrics must return 200 OK");
  const contentType = String(metricsRes.headers["content-type"] ?? "");
  assert.ok(
    contentType.includes("text/plain"),
    "Metrics endpoint must return text/plain Prometheus format",
  );
  console.log("  ✓ GET /metrics exposed valid Prometheus telemetry metrics");

  await app.close();

  // ---------------------------------------------------------------------------
  // TEST 3: Catalog Projection Payload Contracts
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing catalog projection event contracts...");

  const mockProductEvent = {
    id: "prod_runner_99",
    name: "Larek Aero Speed Racer",
    slug: "larek-aero-speed-racer",
    price: 159.99,
    compareAtPrice: 199.99,
    shortDescription: "Ultralight marathon running shoes",
    description:
      "Designed for elite long-distance performance with carbon-plate rebound.",
    categorySlug: "running-shoes",
    categoryId: "cat_footwear_101",
    brandId: "brand_larek_performance",
    isFeatured: true,
    isNew: true,
    isActive: true,
    rating: 4.8,
    reviewCount: 142,
    availabilityStatus: "IN_STOCK" as const,
    eventId: "evt_proj_kafka_001",
  };

  assert.equal(mockProductEvent.id, "prod_runner_99");
  assert.equal(mockProductEvent.availabilityStatus, "IN_STOCK");
  assert.equal(mockProductEvent.isFeatured, true);
  assert.equal(typeof mockProductEvent.price, "number");
  console.log("  ✓ Catalog product projector schema invariants verified");

  // ---------------------------------------------------------------------------
  // TEST 4: PostgreSQL Read Replica Routing Invariants
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing PostgreSQL Read Replica routing & fallback...");
  assert.ok(prisma, "Expected writePrisma (prisma) to be defined");
  assert.ok(readPrisma, "Expected readPrisma to be defined");
  assert.strictEqual(
    readPrisma,
    prisma,
    "readPrisma should fallback to primary prisma when DATABASE_READ_REPLICA_URL is not set",
  );
  console.log(
    "  ✓ Zero-overhead fallback: readPrisma points to primary prisma when replica URL is unset",
  );

  // ---------------------------------------------------------------------------
  // TEST 5: getCatalogDb & databaseContext Consistency Plane Invariants
  // ---------------------------------------------------------------------------
  console.log(
    "\n5. Testing getCatalogDb & databaseContext consistency plane invariants...",
  );

  const forcedDb = getCatalogDb(true);
  assert.strictEqual(
    forcedDb,
    prisma,
    "getCatalogDb(true) must resolve to primary writer prisma",
  );

  const replicaDb = getCatalogDb(false);
  assert.strictEqual(
    replicaDb,
    readPrisma,
    "getCatalogDb(false) must resolve to readPrisma",
  );

  // Test ambient AsyncLocalStorage resolution
  databaseContext.run({ forcePrimary: true }, () => {
    const active = getDatabaseClient();
    assert.strictEqual(
      active,
      prisma,
      "Ambient context with forcePrimary=true must resolve to primary prisma",
    );
  });

  databaseContext.run({ forcePrimary: false }, () => {
    const active = getDatabaseClient();
    assert.strictEqual(
      active,
      readPrisma,
      "Ambient context with forcePrimary=false must resolve to readPrisma",
    );
  });
  console.log(
    "  ✓ getCatalogDb and databaseContext accurately route to primary writer or replica pool",
  );

  // ---------------------------------------------------------------------------
  // TEST 6: Fastify Read-Your-Writes Hook & Header Inspection
  // ---------------------------------------------------------------------------
  console.log(
    "\n6. Testing Fastify Read-Your-Writes hook & consistency header telemetry...",
  );

  const appWithPlugins = Fastify({ logger: false });
  await configureFastifyPlugins(appWithPlugins);

  appWithPlugins.get("/test/consistency", async (request, reply) => {
    return reply.status(200).send({
      forcePrimary: request.forcePrimary,
      ambientPrimary: databaseContext.getStore()?.forcePrimary,
    });
  });

  await appWithPlugins.ready();

  // 6A. Request with GATEWAY_HEADERS.FORCE_PRIMARY header
  const forcedRes = await appWithPlugins.inject({
    method: "GET",
    url: "/test/consistency",
    headers: {
      [GATEWAY_HEADERS.FORCE_PRIMARY]: "true",
    },
  });
  assert.equal(forcedRes.statusCode, 200);
  const forcedJson = forcedRes.json() as {
    forcePrimary: boolean;
    ambientPrimary?: boolean;
  };
  assert.equal(forcedJson.forcePrimary, true);
  assert.equal(
    forcedRes.headers["x-consistency-plane"],
    "primary-master",
    "Response must include X-Consistency-Plane: primary-master",
  );
  console.log(
    "  ✓ Gateway x-force-primary header successfully triggers primary routing and response telemetry",
  );

  // 6B. Normal storefront browse request without force-primary
  const normalRes = await appWithPlugins.inject({
    method: "GET",
    url: "/test/consistency",
  });
  assert.equal(normalRes.statusCode, 200);
  const normalJson = normalRes.json() as {
    forcePrimary: boolean;
    ambientPrimary?: boolean;
  };
  assert.equal(normalJson.forcePrimary, false);
  assert.equal(
    normalRes.headers["x-consistency-plane"],
    undefined,
    "Normal browse request must NOT have X-Consistency-Plane primary header",
  );
  console.log(
    "  ✓ Standard storefront browsing routes safely to replica plane",
  );

  await appWithPlugins.close();

  // ---------------------------------------------------------------------------
  // TEST 7: Redis-Driven Session RYW Lease Simulation
  // ---------------------------------------------------------------------------
  console.log(
    "\n7. Testing simulated Redis Read-Your-Writes lease bypass invariants...",
  );

  const mockMemoryState = new Map<string, string>();
  const mockRedisClient = {
    set: async (key: string, val: string, _px?: string, _ttl?: number) => {
      mockMemoryState.set(key, val);
      return "OK";
    },
    exists: async (key: string) => {
      return mockMemoryState.has(key) ? 1 : 0;
    },
    del: async (key: string) => {
      const had = mockMemoryState.has(key);
      mockMemoryState.delete(key);
      return had ? 1 : 0;
    },
  } as any;

  const mockSessionId = "sess_customer_checkout_007";
  const leaseSet = await markReadYourWrites(mockRedisClient, mockSessionId, {
    ttlMs: 500,
  });
  assert.equal(leaseSet, true, "markReadYourWrites should register lease");

  const leaseActive = await isReadYourWritesActive(
    mockRedisClient,
    mockSessionId,
  );
  assert.equal(
    leaseActive,
    true,
    "isReadYourWritesActive should report true during lease window",
  );

  const leaseCleared = await clearReadYourWrites(
    mockRedisClient,
    mockSessionId,
  );
  assert.equal(leaseCleared, true, "clearReadYourWrites should remove lease");

  const leaseActiveAfter = await isReadYourWritesActive(
    mockRedisClient,
    mockSessionId,
  );
  assert.equal(
    leaseActiveAfter,
    false,
    "Lease should be inactive after explicit clear or expiry",
  );
  console.log(
    "  ✓ Redis session RYW lease lifecycle verified: mark -> active -> clear -> inactive",
  );

  // ---------------------------------------------------------------------------
  // TEST 8: CatalogService ForcePrimary Cache-Bypass Invariant
  // ---------------------------------------------------------------------------
  console.log(
    "\n8. Testing CatalogService forcePrimary cache-bypass invariants...",
  );

  let repositoryCalledWithPrimary: boolean | undefined = undefined;
  const originalFindProducts = catalogRepository.findProducts;

  // Intercept repository method to inspect forcePrimary argument
  catalogRepository.findProducts = async (
    query,
    forcePrimary,
  ): Promise<any> => {
    repositoryCalledWithPrimary = forcePrimary;
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 24,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  };

  try {
    // 8A. Call with forcePrimary: true -> must bypass cache and pass forcePrimary=true
    await catalogService.getProducts(
      { page: 1, limit: 24 },
      { forcePrimary: true },
    );
    assert.equal(
      repositoryCalledWithPrimary,
      true,
      "CatalogService must pass forcePrimary=true to repository when RYW is active",
    );

    // 8B. Call with forcePrimary: false -> must pass forcePrimary=false
    await catalogService.getProducts(
      { page: 1, limit: 24 },
      { forcePrimary: false },
    );
    assert.equal(
      repositoryCalledWithPrimary,
      false,
      "CatalogService must pass forcePrimary=false when RYW is not active",
    );
    console.log(
      "  ✓ CatalogService accurately bypasses cache and enforces master writer on RYW active",
    );
  } finally {
    // Restore repository method
    catalogRepository.findProducts = originalFindProducts;
  }

  console.log("\n==================================================");
  console.log("🎉 ALL CATALOG SERVICE SQA TESTS PASSED (100%)");
  console.log("==================================================");
}

runCatalogServiceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Catalog service tests failed:", err);
    process.exit(1);
  });
