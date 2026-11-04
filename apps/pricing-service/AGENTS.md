# AGENTS.md — apps/pricing-service

Scope: `apps/pricing-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 authoritative merchandise pricing microservice: product base prices, multi-currency conversion,
tiered/bulk volume discounts, B2B/B2C price lists, price history audit logs, and immutable pricing quotes. Port 8019.

**Source-of-truth split (never mix these):**

- PostgreSQL (`pricing_db`, Drizzle ORM) — price_lists, product_prices, variant_prices, price_rules, price_history, price_quotes, and currency_rates.
- Redis — price cache and rate limits. Never authoritative. Outages degrade performance, never correctness.
- Kafka — publishes `pricing.price.created`, `pricing.price.updated`, `pricing.price.expired`, `pricing.quote.created`; consumes `product.deleted` using the repository envelope `producer.send(topic, { value: payload })`.

## Architecture & Layers

- `src/server.ts` & `src/index.ts` — Fastify 5 HTTP server with CORS, defensive security headers, and graceful shutdown.
- `src/db/` — Drizzle ORM schema (`schema.ts`), PostgreSQL connection pool (`connection.ts`), idempotent migrations (`migrate.ts`), and seed script (`seed.ts`).
- `src/engine/` —
  - `calculator.ts`: High-precision financial arithmetic with Decimal.js, volume tier evaluations, promotional quote composition, and negative price prevention.
  - `currency.ts`: Multi-currency conversion using Decimal.js with zero floating-point drift.
- `src/services/` —
  - `pricing.service.ts`: Product base and variant price lookup, Redis caching with SingleFlight promise coalescing, dynamic FX rates, price list creation, updates, and audit history.
  - `quote.service.ts`: Authoritative price quote generation for cart and checkout, batch query optimization (single rule fetch and inArray lookups), persistence of immutable snapshots, and event publication.
- `src/kafka/` — Producers (`producer.ts`) and consumers (`consumer.ts`).
- `src/middleware/` —
  - Clerk JWT validation and gateway header propagation (`requireAdminOrInternal`, `requireInternal`, `isInternalService`).
  - Distributed idempotency middleware (`idempotency.middleware.ts`, `executeWithIdempotency`) with Redis atomic lease locking (`SET NX PX`), 409 Conflict, and `Idempotent-Replayed: true` caching.
- `src/routes/` — Public/customer endpoints (`prices.routes.ts`) and admin endpoints (`admin.routes.ts`).

## Invariants & Distributed Guarantees

- **Thundering-Herd Shielding (`SingleFlight`)**: High-velocity product price lookups (`GET /api/v1/prices/products/:productId`) cache in Redis (`pricing:product:{priceListCode}:{productId}:{currency}`, 300s TTL) and coalesce in-flight promises via `inFlightProductPrices`, shielding PostgreSQL during flash-sale storms.
- **Cache Invalidation**: Price mutations (`upsertProductPrice`, `patchProductPrice`, `createPriceRule`, `upsertCurrencyRate`, `refreshCurrencyRates`) trigger targeted Redis key evictions (`invalidateProductPricing`).
- **Batch Quote Composition**: `quoteService.generateQuote` executes a constant 3 batch queries (`priceRules`, `productPrices` via `inArray`, `variantPrices` via `inArray`) regardless of item count, eliminating $3N$ N+1 query loops.
- **Distributed Idempotency**: State-mutating quote endpoints (`POST /quote`, `POST /bulk-quote`) accept `Idempotency-Key` headers via `executeWithIdempotency` with transparent replay (`Idempotent-Replayed: true`) and in-flight conflict rejection (409 Conflict).

## Routes & Endpoints

- Customer & Public:
  - `GET /api/v1/prices/products/:productId` — gets product base price, variant prices, and rules with currency conversion.
  - `POST /api/v1/prices/quote` — generates authoritative merchandise price quote with volume tiers and promotion deduction.
  - `POST /api/v1/prices/bulk-quote` — generates multiple price quotes in a single request.
- Admin (`requireAdminOrInternal`):
  - `POST /api/v1/admin/price-lists` — creates a new price list (B2C, B2B, or seller-specific).
  - `POST /api/v1/admin/prices` — upserts base and variant prices.
  - `PATCH /api/v1/admin/prices/:priceId` — updates product price and records audit log.
  - `GET /api/v1/admin/prices/:priceId/history` — retrieves price modification history.
- Health:
  - `GET /health` — liveness check.
  - `GET /ready` — readiness check (verifies database connectivity).
  - `GET /api/v1/prices/health` — service health.
  - `GET /metrics` — service uptime and telemetry.
