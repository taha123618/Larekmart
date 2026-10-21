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
  - `pricing.service.ts`: Product base and variant price lookup, currency exchange rates, price list creation, updates, and audit history.
  - `quote.service.ts`: Authoritative price quote generation for cart and checkout, persistence of immutable snapshots, and event publication.
- `src/kafka/` — Producers (`producer.ts`) and consumers (`consumer.ts`).
- `src/middleware/` — Clerk JWT validation and gateway header propagation (`requireAdminOrInternal`, `requireInternal`, `isInternalService`).
- `src/routes/` — Public/customer endpoints (`prices.routes.ts`) and admin endpoints (`admin.routes.ts`).

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
