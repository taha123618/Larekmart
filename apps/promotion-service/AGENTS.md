# AGENTS.md — apps/promotion-service

Scope: `apps/promotion-service` only. Root rules still apply — start there.

## What this service is

Node.js (TypeScript strict) + Hono 4 promotion engine microservice: centralized campaigns, coupon codes, discount eligibility, usage limits, budgets, temporary reservations during checkout, and redemption tracking. Port 8016.

**Source-of-truth split (never mix these):**

- PostgreSQL (`larekmart_promotion_db`, Drizzle ORM) — authoritative for campaign usage, row-level locks, atomic ACID transactions on budgets and redemptions (`promotions`, `promotion_rules`, `promotion_targets`, `coupon_codes`, `promotion_reservations`, `promotion_redemptions`, `promotion_budgets`, `promotion_audit_logs`).
- Redis (`@repo/redis`, `promotion:v1:*`) — active promotion cache with TTL, coupon lookup fast path, and rate limits. Outages degrade performance, never data correctness.
- Kafka — asynchronously consumes order lifecycle events (`order.created`, `order.confirmed`, `order.completed`, `order.cancelled`) to commit or release promotion reservations; publishes lifecycle events (`promotion.created`, `promotion.activated`, `promotion.deactivated`, `promotion.reserved`, `promotion.redeemed`, `promotion.reservation.released`, `promotion.budget.exhausted`) using the repository envelope `producer.send(topic, { value: payload })`.

## Architecture & Layers

- `src/server.ts` & `src/index.ts` — Hono 4 HTTP application with CORS, request logging, and graceful teardown.
- `src/db/` — Drizzle ORM schema (`schema.ts`), PostgreSQL connection pool (`connection.ts`), and idempotent migrations (`migrate.ts`).
- `src/repositories/` — Isolated data access layer:
  - `promotion.repository.ts`: CRUD, active promotions lookup, activation/deactivation, audit logging, and admin overview metrics.
  - `coupon.repository.ts`: Coupon creation, lookup by code, and atomic usage counters.
  - `budget.repository.ts`: Atomic budget reservation, commitment (reserved -> spent), release, and exhaustion detection.
  - `reservation.repository.ts`: Idempotent reservation creation, customer limit checks, order commitment, release, and expired cleanup.
- `src/services/` — Business logic:
  - `promotion-evaluator.ts`: Target matching (PRODUCT, CATEGORY, SELLER, ORDER inclusions/exclusions), customer segment verification, minOrderAmount enforcement, discount computation (PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING), and priority/stacking rule resolution.
  - `promotion.service.ts`: Active promotions with Redis caching, coupon validation, cart quotes, ACID reservations, order commits, and administrative flows.
- `src/events/` — Kafka producers (`producers/promotion.producer.ts`) and consumers (`consumers/order-events.consumer.ts`).
- `src/middleware/` — Clerk JWT validation and gateway header propagation (`shouldBeUser`, `shouldBeAdmin`, `optionalUserOrGuest`).
- `src/observability/` — Prometheus metrics and structured Pino logger via `@repo/monitoring`.
- `src/workers/` — `reservation-expiry.worker.ts`: periodically releases abandoned reservations whose TTL expired.

## Routes & Endpoints

- Customer / Public (`optionalUserOrGuest`):
  - `GET /api/v1/promotions/active` — retrieves currently active promotional campaigns.
  - `GET /api/v1/promotions/:promotionId` — retrieves promotion details.
  - `POST /api/v1/promotions/validate` — validates a coupon code against cart items.
  - `POST /api/v1/promotions/quote` — calculates applicable discounts and stacking quotes for cart items.
  - `POST /api/v1/promotions/reservations` — creates an atomic, idempotent reservation hold during checkout.
  - `POST /api/v1/promotions/reservations/:id/commit` — commits a reservation upon order finalization.
  - `POST /api/v1/promotions/reservations/:id/release` — releases a reserved promotion upon checkout abandonment or cancellation.
- Admin (`shouldBeAdmin` required):
  - `GET /api/v1/admin/promotions` — paginated list of all campaigns with status, search, and type filters.
  - `POST /api/v1/admin/promotions` — creates a new campaign promotion.
  - `PATCH /api/v1/admin/promotions/:promotionId` — updates campaign rules, budget, or dates.
  - `POST /api/v1/admin/promotions/:promotionId/activate` — activates a promotion.
  - `POST /api/v1/admin/promotions/:promotionId/deactivate` — deactivates a promotion.
  - `POST /api/v1/admin/coupons` — generates coupon codes for campaigns.
  - `GET /api/v1/admin/promotions/:promotionId/redemptions` — paginated redemptions history for a campaign.
  - `GET /api/v1/admin/promotions/overview` — aggregate metrics (total promotions, active campaigns, total redemptions, total discount given).
- Health & Observability:
  - `GET /health` — liveness check.
  - `GET /ready` — readiness check (verifies PostgreSQL and Redis connectivity).
  - `GET /metrics` — Prometheus metrics snapshot.

## Testing & Quality

- Test suite runner: `tests/promotion-service.test.ts` via standalone `tsx`.
- Run tests: `pnpm --filter promotion-service test`.
- Type-check: `pnpm --filter promotion-service check-types`.
