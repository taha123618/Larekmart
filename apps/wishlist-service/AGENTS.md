# AGENTS.md — apps/wishlist-service

Scope: `apps/wishlist-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 wishlist microservice: saved products, multiple named wishlists, duplicate prevention,
guest-to-user merging, item transfers, unguessable share tokens, and price-drop & restock alerts. Port 8015.

**Source-of-truth split (never mix these):**

- PostgreSQL (`wishlist_db`, Drizzle ORM) — wishlists, wishlist_items, wishlist_shares, and wishlist_events.
- Redis — share token fast resolution (`wishlist:v1:share:<token>`) and rate limits.
  Never authoritative. Outages degrade cache performance, never correctness.
- Kafka — asynchronously consumes product and inventory events (`product.updated`, `product.deleted`,
  `price.updated`, `inventory.availability.changed`, `inventory.adjusted`, `user.deleted`) to track
  price drops and restocks; publishes lifecycle events (`wishlist.created`, `wishlist.item.added`,
  `wishlist.item.removed`, `wishlist.item.moved`, `wishlist.merged`, `wishlist.price-drop`, `wishlist.restocked`)
  using the repository envelope `producer.send(topic, { value: payload })`.

## Architecture & Layers

- `src/server.ts` & `src/index.ts` — Fastify 5 HTTP application with CORS, request logging, and graceful teardown.
- `src/db/` — Drizzle ORM schema (`schema.ts`), PostgreSQL connection pool (`connection.ts`), and idempotent migrations (`migrate.ts`).
- `src/repositories/` — Isolated data access layer for wishlists, wishlist items, and shares:
  - `wishlist.repository.ts`: User and guest wishlist lookup, default wishlist management, audit logs.
  - `wishlist-item.repository.ts`: Item persistence, unique constraint enforcement, item moves, price & stock updates.
  - `wishlist-share.repository.ts`: Unguessable token generation, expiration verification.
- `src/services/` — Business logic (`wishlist.service.ts`):
  - Automatically initializes default wishlist for authenticated customers.
  - Enforces duplicate item prevention per wishlist.
  - Guest wishlist migration on login with configurable conflict strategies.
  - Generates unguessable 64-char crypto tokens with expiration.
- `src/events/` — Kafka producers (`producers/wishlist.producer.ts`) and consumers (`consumers/product-events.consumer.ts`, `consumers/inventory-events.consumer.ts`, `consumers/user-events.consumer.ts`).
- `src/middleware/` — Clerk JWT validation and gateway header propagation (`shouldBeUser`, `optionalUserOrGuest`).
- `src/observability/` — Prometheus metrics and structured Pino logger via `@repo/monitoring`.

## Routes & Endpoints

- Customer (`shouldBeUser` / `optionalUserOrGuest`):
  - `GET /api/v1/me/wishlists` — retrieves user wishlists (auto-creates default wishlist if none exists).
  - `POST /api/v1/me/wishlists` — creates a new named wishlist.
  - `POST /api/v1/me/wishlists/merge` — merges guest wishlist into user's default wishlist.
  - `GET /api/v1/me/wishlists/:wishlistId` — retrieves wishlist details and items.
  - `PATCH /api/v1/me/wishlists/:wishlistId` — updates wishlist name or visibility.
  - `DELETE /api/v1/me/wishlists/:wishlistId` — deletes wishlist and contained items.
  - `POST /api/v1/me/wishlists/:wishlistId/items` — adds product or variant to wishlist with duplicate prevention.
  - `DELETE /api/v1/me/wishlists/:wishlistId/items/:itemId` — removes single item.
  - `DELETE /api/v1/me/wishlists/:wishlistId/items` — bulk item removal.
  - `POST /api/v1/me/wishlists/:wishlistId/items/move` — moves item between wishlists.
  - `POST /api/v1/me/wishlists/:wishlistId/share` — generates unguessable share token.
- Public:
  - `GET /api/v1/shared-wishlists/:shareToken` — resolves shared wishlist via token without exposing private wishlist IDs.
- Health:
  - `GET /health` — liveness check.
  - `GET /ready` — readiness check (verifies PostgreSQL and Redis connectivity).
  - `GET /metrics` — Prometheus metrics snapshot.

## Testing & Quality

- Test suite runner: `tests/wishlist-service.test.ts` via standalone `tsx`.
- Run tests: `pnpm --filter wishlist-service test`.
- Type-check: `pnpm --filter wishlist-service check-types`.
