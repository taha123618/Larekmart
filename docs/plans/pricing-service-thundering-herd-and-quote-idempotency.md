# Architectural Plan: Pricing Service Thundering-Herd Shielding, Distributed Quote Idempotency & Batch Optimization

## Executive Summary

The **Pricing Service** (`apps/pricing-service`, port 8019) is the authoritative merchandise pricing engine across Larekmart. Under high-concurrency flash sales and traffic spikes, two major distributed bottlenecks emerge:

1. **Cache Stampedes / Thundering Herd on Product Price Reads (`GET /api/v1/prices/products/:productId`)**: Every single read executes 4 un-cached relational database queries across `price_lists`, `product_prices`, `variant_prices`, and `price_rules`. Without in-flight promise coalescing and Redis tier caching, thousands of simultaneous customer visits exhaust database connection pools.
2. **N+1 Query Explosion & Uncached Exchange Rates in Quote Composition (`quoteService.generateQuote`)**: Multi-item cart checkout quotes execute $3N$ queries inside the item iteration loop, repeatedly fetching price rules for the exact same `priceListId` and querying raw `currency_rates` from PostgreSQL on every quote.
3. **Absence of Distributed Idempotency on Quote Creation (`POST /api/v1/prices/quote`)**: Quotes write immutable snapshots to `price_quotes` and dispatch Kafka `pricing.quote.created` events. Network retries from storefront checkouts lead to duplicate quote persistence and duplicate event emissions.

---

## 1. System Architecture & In-Flight Flow

```
[Storefront Customer / Cart Client]
       │
       ├──► GET /api/v1/prices/products/:productId?currency=EUR
       │         │
       │         ▼
       │    [Redis Price Cache] ──(Hit)──► Return Cached Converted Price (<2ms)
       │         │ (Miss)
       │         ▼
       │    [SingleFlight Coalescing Engine] ──(In-Flight)──► Join Existing Promise
       │         │ (Leader)
       │         ▼
       │    [PostgreSQL Primary] ──► Cache in Redis (300s TTL) & Return
       │
       └──► POST /api/v1/prices/quote (Header: Idempotency-Key)
                 │
                 ▼
            [Fastify Idempotency Interceptor]
                 ├─► [Redis SET NX PX] Lease Acquired
                 │         ├─► In-Flight: Return 409 Conflict
                 │         └─► Completed: Replay Cached Quote (`Idempotent-Replayed: true`)
                 ▼
            [Batch Quote Engine]
                 ├─► Single query for all price rules matching priceListId & isActive
                 ├─► Single batch query for productPrices via inArray
                 ├─► Single batch query for variantPrices via inArray
                 ├─► Redis FX rate lookup (SingleFlight)
                 └─► Persist quote & emit Kafka pricing.quote.created
```

---

## 2. Detailed Technical Plan

### Stage 1: Database Composite Indexing (`apps/pricing-service/src/db/schema.ts`)

- Add composite index `price_rules_list_active_idx` on `(priceListId, isActive)` in `priceRules`.
- Add composite index `product_prices_list_product_active_idx` on `(priceListId, productId, isActive)` in `productPrices`.

### Stage 2: Product Price Redis Caching & SingleFlight Shielding (`apps/pricing-service/src/services/pricing.service.ts`)

- Implement Redis caching for `getProductPrice` with cache key `pricing:product:${priceListCode || "default"}:${productId}:${targetCurrency}` and 300s TTL.
- Implement in-flight promise coalescing (`inFlightProductPrices: Map<string, Promise<...>>`) to coalesce concurrent cache misses for the identical product and target currency.
- Implement cache invalidation (`invalidateProductPricing`): on price upserts, updates, variant updates, or rule modifications, purge matching Redis keys.

### Stage 3: Batch Optimization in Quote Engine (`apps/pricing-service/src/services/quote.service.ts`)

- Replace the $3N$ query loop in `generateQuote`:
  - Fetch all applicable rules for `priceList.id` where `isActive = true` **once** upfront.
  - Extract all unique `productId`s and batch-query `productPrices` via `inArray`.
  - Extract found `productPrice.id`s and batch-query `variantPrices` via `inArray`.
  - Use `pricingService.getExchangeRate` with Redis caching instead of querying raw `currencyRates` on every quote.

### Stage 4: Distributed Idempotency on Fastify Quote Endpoints (`apps/pricing-service/src/middleware/idempotency.middleware.ts` & `routes/prices.routes.ts`)

- Implement `executeWithIdempotency` in `apps/pricing-service/src/middleware/idempotency.middleware.ts` leveraging `@repo/redis` (`acquireIdempotencyLock`, `commitIdempotencyResponse`, `releaseIdempotencyLock`).
- Wrap `POST /api/v1/prices/quote` and `POST /api/v1/prices/bulk-quote` with distributed idempotency execution.
- When replayed, return `Idempotent-Replayed: true`. When conflict, return 409 Conflict.

### Stage 5: Storefront Client Integration (`apps/client/src/services/pricing.service.ts`)

- Accept optional `idempotencyKey?: string` in `fetchPriceQuote` and `fetchBulkPriceQuote`, forwarding the `Idempotency-Key` header to the API Gateway.

### Stage 6: Automated Verification & Test Suite

- Author `apps/pricing-service/tests/pricing-concurrency-and-idempotency.test.ts`.
- Run `pnpm --filter pricing-service test`.
- Run `pnpm check-types` across all 41 packages in the monorepo.
