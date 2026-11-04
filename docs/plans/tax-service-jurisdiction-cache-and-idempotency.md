# Architectural Plan: Tax Service Jurisdiction Rule Caching, SingleFlight Stampede Protection & Distributed Calculation Idempotency

## Executive Summary

The **Tax Service** (`apps/tax-service`, port 8017) provides jurisdiction-aware tax calculations, legal tax rules, customer exemptions, and immutable calculation snapshots for checkout and orders. Under high-velocity cart and checkout traffic, three critical distributed bottlenecks emerge:
1. **Uncached Relational Lookups & N+1 Query Loops in Tax Calculations (`executeTaxCalculation`)**: Every tax quote or calculation executes sequential database queries against `tax_jurisdictions`, fires individual per-category queries against `tax_categories` (`Promise.all(categoryCodes.map(...))`), queries `tax_exemptions`, and performs multi-table inner joins on `tax_rules`.
2. **Cache Stampedes / Thundering Herd during Flash Sales (`POST /api/v1/tax/quote`)**: Hundreds of shoppers in the same geographic region checking out simultaneously repeatedly trigger identical jurisdiction and tax rule queries, exhausting connection pools.
3. **Absence of Distributed Idempotency on Authoritative Tax Calculations (`POST /api/v1/tax/calculate`)**: When orders finalize, `calculateTax` generates a new calculation ID and inserts rows into `tax_calculations` and `tax_calculation_lines`. Client network retries create duplicate snapshots and desynchronize financial audits.

---

## 1. System Architecture & Request Flow

```
[Storefront Customer / Checkout Saga]
       │
       ├──► POST /api/v1/tax/quote
       │         │
       │         ▼
       │    [SingleFlight Coalescing Engine] ──(In-Flight)──► Join Existing Promise
       │         │
       │         ▼
       │    [Redis Jurisdiction & Rules Cache] ──(Hit)──► Return Pre-Computed Tax Rate (<2ms)
       │         │ (Miss)
       │         ▼
       │    [Batch MySQL Engine]
       │         ├─► findMatchingJurisdictions (Cached 1h)
       │         ├─► findByCodes via inArray (1 query instead of M)
       │         └─► findActiveMatchingRules (Cached 1h)
       │
       └──► POST /api/v1/tax/calculate (Header: Idempotency-Key)
                 │
                 ▼
            [Fastify Idempotency Interceptor]
                 ├─► [Redis SET NX PX] Atomic Lease
                 │         ├─► In-Flight: Return 409 Conflict
                 │         └─► Completed: Replay Cached Calculation (`Idempotent-Replayed: true`)
                 ▼
            [Authoritative Calculation Engine]
                 ├─► Persist calculation snapshot & lines to MySQL
                 └─► Commit response to Redis (24h retention) & Return 200
```

---

## 2. Detailed Technical Plan

### Stage 1: Database Composite Indexing (`apps/tax-service/src/db/schema.ts`)
- Add composite index on `tax_calculations(reference_type, reference_id)`.
- Add composite index on `tax_rules(jurisdiction_id, category_id, is_active)`.
- Add composite index on `tax_jurisdictions(country_code, region_code, is_active)`.

### Stage 2: Jurisdiction & Tax Rule Multi-Tier Caching (`jurisdiction.repository.ts` & `tax-rule.repository.ts`)
- Cache matching jurisdictions in Redis (`tax:v1:jurisdictions:{country}:{region}:{municipality}`, 3600s TTL).
- Cache matching tax rules in Redis (`tax:v1:rules:{jurisdictionIds}:{categoryIds}`, 3600s TTL).
- Wire cache eviction: evict `tax:v1:rules:*` on rule updates (`handleTaxRulesUpdatedEvent` and admin mutations).

### Stage 3: Batch Category Resolution & SingleFlight Coalescing (`tax-category.repository.ts` & `tax.service.ts`)
- Implement `taxCategoryRepository.findByCodes(codes)` using `inArray(taxCategories.code, normalizedCodes)` to resolve all categories in a single query.
- Add SingleFlight promise coalescing (`inFlightQuotes`) in `taxService.quoteTax` to coalesce concurrent quote requests for identical line items and destination addresses.

### Stage 4: Fastify Distributed Idempotency (`apps/tax-service/src/middleware/idempotency.middleware.ts` & `controllers/tax.controller.ts`)
- Create Fastify distributed idempotency wrapper `executeWithIdempotency` backed by `@repo/redis`.
- Apply idempotency protection to `POST /api/v1/tax/calculate` and `POST /api/v1/tax/quote`.
- Transparently replay cached calculations with `Idempotent-Replayed: true` and reject concurrent in-flight mutations with 409 Conflict.

### Stage 5: Automated Verification & Test Suite
- Author `apps/tax-service/tests/tax-concurrency-and-idempotency.test.ts`.
- Run `pnpm --filter tax-service test`.
- Run `pnpm check-types` across all 41 packages in the monorepo.

