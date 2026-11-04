# AGENTS.md — apps/commission-service

Scope: `apps/commission-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 microservice running on port 8022 using Drizzle ORM backed by PostgreSQL (`commission_db`), `@repo/redis` for caching, `@repo/kafka` for asynchronous event distribution, `decimal.js` for arbitrary-precision financial calculations, and `@repo/types` for contracts.
It provides marketplace commission rates, tier rules, versioning, line-item fee calculations, adjustments for returns/refunds, and publishes commission obligations for settlement processing.

## Architecture & Responsibilities

- **Authoritative Plan & Testing Blueprint**: [docs/plans/commission-and-payout-architecture-and-testing.md](../../docs/plans/commission-and-payout-architecture-and-testing.md).
- **Commission Plans & Rules**: Configures category, seller, product, and global marketplace commission tiers.
- **Hierarchical Precedence**: Resolves fees with precedence: `PRODUCT` > `SELLER` > `CATEGORY` > `GLOBAL`.
- **High-Precision Arithmetic**: Uses `Decimal.js` to eliminate binary floating-point roundoff errors.
- **Rule Versioning**: Immutable snapshot versions (`commission_rule_versions`) ensure historical settlements are never corrupted by future rule changes.
- **Lifecycle Integration**:
  - `POST /api/v1/internal/commissions/quote` — Real-time quote evaluation for cart and checkout.
  - `commission.accrued` — Authoritative commission liability stamped upon order confirmation.
  - `commission.adjusted` — Reversal/adjustment when returns are processed.
  - `commission.reversed` — Full reversal when orders are cancelled.

## Key Directories

- `src/index.ts` / `src/server.ts` — Server entrypoint and graceful shutdown.
- `src/app.ts` — Fastify application factory with CORS, defensive HTTP headers, and error handling.
- `src/config/env.ts` — Zod validated configuration (`PORT=8022`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `INTERNAL_SERVICE_SECRET`).
- `src/db/` —
  - `schema.ts`: Drizzle schema defining `commission_plans`, `commission_rules`, `commission_rule_versions`, `commission_calculations`, `commission_line_items`, and `commission_adjustments`.
  - `connection.ts`: PostgreSQL connection pool with PgBouncer statement cache suppression (`statement_cache_size=0`).
  - `migrate.ts`: Idempotent database migration script.
- `src/engine/commission-calculator.ts` — Core Decimal.js rule resolution and min/max clamp calculator.
- `src/services/commission.service.ts` — Business logic for quotes, accruals, adjustments, and reports.
- `src/kafka/` — `producer.ts` and `consumer.ts` implementing Kafka envelope conventions `{ value: payload }`.
- `src/routes/` — `internal.routes.ts`, `admin.routes.ts`, `health.routes.ts`.
- `tests/` — Automated test suite with `tsx`.

## Verification Commands

- Run unit & integration tests:
  ```bash
  pnpm --filter commission-service test
  ```
- Run typecheck:
  ```bash
  pnpm --filter commission-service check-types
  ```
