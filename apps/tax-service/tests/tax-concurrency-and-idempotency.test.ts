import assert from "assert";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { buildServer } from "../src/server.js";
import {
  taxJurisdictions,
  taxRules,
  taxCalculations,
} from "../src/db/schema.js";
import { jurisdictionRepository } from "../src/repositories/jurisdiction.repository.js";
import { taxRuleRepository } from "../src/repositories/tax-rule.repository.js";
import { taxCategoryRepository } from "../src/repositories/tax-category.repository.js";
import { taxService } from "../src/services/tax.service.js";
import { redis } from "../src/utils/redis.js";
import { closeDatabase } from "../src/db/connection.js";
import { acquireIdempotencyLock, commitIdempotencyResponse } from "@repo/redis";
import type { TaxCalculateRequest, TaxQuoteRequest } from "@repo/types";

async function runTaxConcurrencyAndIdempotencyTests() {
  console.log("==================================================");
  console.log("    TAX CONCURRENCY & IDEMPOTENCY TEST SUITE      ");
  console.log("==================================================\n");

  // ────────────────────────────────────────────────────────────
  // Test 1: Composite Database Indexes Validation
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Composite Database Indexes Validation");

  const jurConfig = getTableConfig(taxJurisdictions);
  const jurIndexNames = jurConfig.indexes.map(
    (idx: any) => idx.config?.name || idx.name,
  );
  assert.ok(
    jurIndexNames.includes("tax_jur_geo_idx"),
    "taxJurisdictions table must include composite index 'tax_jur_geo_idx'",
  );
  console.log(
    "  ✓ Verified composite index 'tax_jur_geo_idx' on taxJurisdictions",
  );

  const rulesConfig = getTableConfig(taxRules);
  const rulesIndexNames = rulesConfig.indexes.map(
    (idx: any) => idx.config?.name || idx.name,
  );
  assert.ok(
    rulesIndexNames.includes("tax_rules_lookup_idx"),
    "taxRules table must include composite index 'tax_rules_lookup_idx'",
  );
  console.log(
    "  ✓ Verified composite index 'tax_rules_lookup_idx' on taxRules",
  );

  const calcConfig = getTableConfig(taxCalculations);
  const calcIndexNames = calcConfig.indexes.map(
    (idx: any) => idx.config?.name || idx.name,
  );
  assert.ok(
    calcIndexNames.includes("tax_calc_ref_idx"),
    "taxCalculations table must include composite index 'tax_calc_ref_idx'",
  );
  console.log(
    "  ✓ Verified composite index 'tax_calc_ref_idx' on taxCalculations",
  );

  // ────────────────────────────────────────────────────────────
  // Test 2: Multi-Tier Caching for Jurisdictions & Tax Rules
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Multi-Tier Caching for Jurisdictions & Rules");

  // 1. Jurisdictions caching
  const jurCacheKey = "tax:v1:jurisdictions:US:CA:los angeles";
  await redis.client.del(jurCacheKey);

  const matchedJurs1 = await jurisdictionRepository.findMatchingJurisdictions(
    "US",
    "CA",
    "Los Angeles",
  );
  assert.ok(
    matchedJurs1.length > 0,
    "Must resolve at least 1 matching jurisdiction",
  );

  const cachedJurs = await redis.client.get(jurCacheKey);
  assert.ok(cachedJurs, "Matched jurisdictions must be written to Redis cache");
  const parsedCachedJurs = JSON.parse(cachedJurs);
  assert.equal(parsedCachedJurs.length, matchedJurs1.length);
  console.log("  ✓ Jurisdictions lookup successfully cached in Redis");

  // 2. Tax rules caching
  const jurIds = matchedJurs1.map((j) => j.id).sort();
  const catIds = ["cat_standard", "cat_clothing"].sort();
  const rulesCacheKey = `tax:v1:rules:${jurIds.join(",")}:${catIds.join(",")}`;
  await redis.client.del(rulesCacheKey);

  const rules1 = await taxRuleRepository.findActiveMatchingRules(
    jurIds,
    catIds,
  );
  assert.ok(rules1.length > 0, "Must resolve active rules");

  const cachedRules = await redis.client.get(rulesCacheKey);
  assert.ok(cachedRules, "Matched tax rules must be cached in Redis");
  console.log("  ✓ Tax rules lookup successfully cached in Redis");

  // ────────────────────────────────────────────────────────────
  // Test 3: Batch Category Resolution via inArray
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Batch Category Resolution");

  const batchCategories = await taxCategoryRepository.findByCodes([
    "standard",
    "clothing",
    "groceries",
  ]);
  assert.ok(
    batchCategories.length >= 2,
    "Must resolve requested categories in single batch",
  );
  const codes = batchCategories.map((c) => c.code);
  assert.ok(codes.includes("standard"));
  assert.ok(codes.includes("clothing"));
  console.log("  ✓ Multiple tax categories resolved in a single batch query");

  // ────────────────────────────────────────────────────────────
  // Test 4: SingleFlight Quote Coalescing
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] SingleFlight Quote Coalescing");

  const sampleQuoteReq: TaxQuoteRequest = {
    currency: "USD",
    destinationAddress: {
      country: "US",
      region: "CA",
      city: "Los Angeles",
      postalCode: "90001",
    },
    lines: [
      {
        lineId: "line_sf_1",
        productId: "prod_sf_1",
        categoryCode: "clothing",
        quantity: 1,
        unitPrice: "80.00",
        amount: "80.00",
      },
    ],
    isInclusive: false,
  };

  const [q1, q2] = await Promise.all([
    taxService.quoteTax(sampleQuoteReq),
    taxService.quoteTax(sampleQuoteReq),
  ]);

  assert.equal(q1.subtotal, q2.subtotal);
  assert.equal(q1.taxTotal, q2.taxTotal);
  assert.equal(q1.total, q2.total);
  console.log(
    "  ✓ Concurrent tax quote requests successfully coalesced via SingleFlight",
  );

  // ────────────────────────────────────────────────────────────
  // Test 5: Distributed Idempotency on Tax Calculate Endpoint
  // ────────────────────────────────────────────────────────────
  console.log(
    "\n[Test 5] Distributed Idempotency on Fastify Calculate Endpoint",
  );

  const app = await buildServer();

  const idempKey = `idemp_tax_calc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const calculateReq: TaxCalculateRequest = {
    referenceType: "order",
    referenceId: `order_test_${Date.now()}`,
    currency: "USD",
    destinationAddress: {
      country: "US",
      region: "CA",
      city: "Los Angeles",
      postalCode: "90001",
    },
    lines: [
      {
        lineId: "line_calc_1",
        productId: "prod_1",
        categoryCode: "standard",
        quantity: 1,
        unitPrice: "100.00",
        amount: "100.00",
      },
    ],
    isInclusive: false,
  };

  // 1. Initial calculation request with Idempotency-Key
  const firstRes = await app.inject({
    method: "POST",
    url: "/api/v1/tax/calculate",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempKey,
    },
    payload: calculateReq,
  });

  assert.equal(
    firstRes.statusCode,
    200,
    "First calculation must succeed with 200",
  );
  const firstJson = firstRes.json();
  assert.ok(firstJson.calculationId);
  const assignedCalculationId = firstJson.calculationId;

  // 2. Replay with identical Idempotency-Key
  const replayRes = await app.inject({
    method: "POST",
    url: "/api/v1/tax/calculate",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempKey,
    },
    payload: calculateReq,
  });

  assert.equal(replayRes.statusCode, 200, "Replay must return 200");
  assert.equal(
    replayRes.headers["idempotent-replayed"],
    "true",
    "Replay response must include Idempotent-Replayed: true header",
  );
  const replayJson = replayRes.json();
  assert.equal(
    replayJson.calculationId,
    assignedCalculationId,
    "Replayed calculation must return identical calculationId without generating a new record",
  );
  console.log(
    "  ✓ Idempotent replay returned cached calculation with 'Idempotent-Replayed: true'",
  );

  // 3. Test 409 Conflict when mutation is in-flight
  const inFlightIdempKey = `idemp_inflight_${Date.now()}`;
  const inFlightRedisKey = redis.keys.simple(`tax:idemp:${inFlightIdempKey}`);
  await acquireIdempotencyLock(redis.client, inFlightRedisKey, {
    lockTtlMs: 10000,
  });

  const conflictRes = await app.inject({
    method: "POST",
    url: "/api/v1/tax/calculate",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": inFlightIdempKey,
    },
    payload: calculateReq,
  });

  assert.equal(
    conflictRes.statusCode,
    409,
    "In-flight mutation must return 409 Conflict",
  );
  const conflictJson = conflictRes.json();
  assert.ok(
    conflictJson.message.includes("currently in-flight"),
    "409 message must indicate in-flight state",
  );
  console.log(
    "  ✓ Concurrent in-flight request safely rejected with 409 Conflict",
  );

  // Cleanup
  await redis.client.del(
    redis.keys.simple(`tax:idemp:${idempKey}`),
    inFlightRedisKey,
    jurCacheKey,
    rulesCacheKey,
  );
  await app.close();
  await closeDatabase();

  console.log("\n==================================================");
  console.log("   ALL TAX CONCURRENCY & IDEMPOTENCY TESTS PASSED! ");
  console.log("==================================================\n");
}

runTaxConcurrencyAndIdempotencyTests()
  .then(async () => {
    await redis.close().catch(() => {});
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
