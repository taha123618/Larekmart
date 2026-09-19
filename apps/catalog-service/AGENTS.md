# catalog-service — AGENTS.md

> Scope: `apps/catalog-service` and `packages/catalog-db`

## 1. Purpose

`catalog-service` is the **read-optimized product discovery** microservice. It owns the CQRS read
models for the storefront — product listing pages, category trees, brand pages, curated
collections, featured/new/best-seller carousels, and merchandising. It **does NOT** own authoritative
product mutations — those live in `product-service`.

This service implements the architecture described in the catalog-service recommendation: a
Kafka-driven read model that keeps `product-service` isolated as the source of truth while giving
the storefront fast, denormalized catalog queries.

## 2. Architecture

- **Runtime**: Fastify 5 (TypeScript, ESM)
- **Database**: PostgreSQL via `@repo/catalog-db` (Prisma)
- **Cache**: Redis via `@repo/redis` (`catalog:v1:` prefix, configurable TTL)
- **Messaging**: Kafka via `@repo/kafka`
- **Port**: 8010

### Data flow

```
product-service  →  Kafka (product.created/updated/deleted)  →  catalog-service (projectors)  →  catalog-db (read models)
inventory-service  →  Kafka (inventory.adjusted/restocked)   →  catalog-service (projectors)  →  catalog-db (availability)
product-service (category.*)  →  Kafka                       →  catalog-service (projectors)  →  catalog-db (category tree)
client/admin  →  HTTP GET  →  catalog-service  →  Redis cache-aside  →  catalog-db
```

### Read model separation

| Concern              | Where it lives                            |
|----------------------|-------------------------------------------|
| Product source truth | `product-service` (Postgres)             |
| Catalog read model   | `catalog-service` → `catalog-db`         |
| Full-text search     | `search-service` (OpenSearch)            |
| Inventory truth      | `inventory-service`                       |
| Pricing authority    | `product-service` + promotions           |
| Cart pricing         | `cart-service`                           |

**catalog-service is NOT a second product CRUD service.** It does not accept product writes.
It only consumes Kafka events and serves read-optimized views.

## 3. Key Directories

```
apps/catalog-service/
├── src/
│   ├── config/env.ts            — Zod env validation
│   ├── observability/metrics.ts — Prometheus counters/histograms, logger
│   ├── cache/
│   │   └── catalog-cache.ts     — CatalogCacheKeys, getCached/setCached/invalidate helpers
│   ├── utils/
│   │   ├── redis.ts             — RedisService singleton
│   │   ├── kafka.ts             — producer + consumer singletons
│   │   └── mappers.ts           — Prisma → API read-model mappers
│   ├── repositories/            — Prisma queries (no business logic)
│   ├── read-model/              — CQRS Projectors (idempotent event handlers)
│   │   ├── product-projector.ts
│   │   ├── category-projector.ts
│   │   └── collection-projector.ts
│   ├── services/                — Cache-aside retrieval + business rules
│   │   ├── catalog.service.ts   — product listing, featured, new-arrivals, best-sellers
│   │   ├── category.service.ts  — category tree + category product pages
│   │   ├── brand.service.ts     — brand listing + brand product pages
│   │   ├── collection.service.ts— collection lookups
│   │   └── merchandising.service.ts — storefront overview composition
│   ├── controllers/             — Fastify request/reply handlers
│   ├── routes/                  — Fastify plugin route registrations
│   ├── consumers/               — Kafka consumer handlers + subscription registry
│   │   ├── index.ts             — startKafkaConsumers() + topic subscription table
│   │   ├── product.consumer.ts
│   │   ├── category.consumer.ts
│   │   └── inventory.consumer.ts
│   ├── publishers/              — Kafka producer helpers (catalog.publisher.ts)
│   ├── plugins/fastify.ts       — CORS, error handler
│   ├── server.ts                — Fastify instance factory
│   └── index.ts                 — Entrypoint with lifecycle management
└── packages/catalog-db/         — Prisma schema + generated client
```

## 4. API Endpoints (prefix: /api/v1/catalog)

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| GET    | /products                   | Paginated product listing w/ filters |
| GET    | /products/:id               | Single product card (id or slug)     |
| GET    | /categories                 | All categories (flat or ?tree=true)  |
| GET    | /categories/:id             | Category detail (id or slug)         |
| GET    | /categories/:id/products    | Products in a category               |
| GET    | /brands                     | All active brands                    |
| GET    | /brands/:id                 | Brand detail (id or slug)            |
| GET    | /brands/:id/products        | Products for a brand                 |
| GET    | /collections                | All active collections               |
| GET    | /collections/:id            | Collection with product cards        |
| GET    | /featured                   | Featured products                    |
| GET    | /new-arrivals               | New arrival products                 |
| GET    | /best-sellers               | Best-selling products                |
| GET    | /storefront                 | Storefront overview (hero + sections)|
| GET    | /health                     | Liveness check                       |
| GET    | /ready                      | Readiness check (DB + Redis)         |
| GET    | /metrics                    | Prometheus metrics                   |

## 5. Kafka Topics Consumed

| Topic                | Projector                 | Action                                              |
|----------------------|---------------------------|-----------------------------------------------------|
| `product.created`    | ProductProjector          | Upsert `CatalogProduct` read model + variants       |
| `product.updated`    | ProductProjector          | Update product read model, invalidate cache         |
| `product.deleted`    | ProductProjector          | Soft-delete (set `isActive=false`), invalidate cache|
| `category.created`   | CategoryProjector         | Upsert `CatalogCategory` hierarchy                  |
| `category.updated`   | CategoryProjector         | Update category, invalidate category-tree cache     |
| `category.deleted`   | CategoryProjector         | Soft-delete category                                |
| `inventory.adjusted` | ProductProjector          | Update `availabilityStatus` on product read model   |
| `inventory.restocked`| ProductProjector          | Update `availabilityStatus` on product read model   |
| `inventory.low_stock`| ProductProjector          | Update `availabilityStatus` on product read model   |

### Topics NOT yet consumed (gaps)

| Topic               | Gap                                           |
|---------------------|-----------------------------------------------|
| `brand.created`     | Missing — brand read model not event-driven   |
| `brand.updated`     | Missing — brand read model not event-driven   |
| `collection.*`      | Missing — collection read model not event-driven|
| `pricing.*`         | Missing — price updates only via product events|
| `review.created`    | Missing — rating/review count not event-driven|

## 6. Idempotency

Every projector uses the `ProcessedEvent` table to deduplicate by `eventId`:

1. Kafka event arrives
2. Check `processedEvent.findUnique({ where: { eventId } })`
3. If already processed → skip
4. Apply read-model update
5. Invalidate relevant Redis cache keys
6. `processedEvent.create({ eventId, eventType })`
7. Commit Kafka offset

This handles consumer restarts and redelivered messages safely.

## 7. Rules

- **Projectors are idempotent** — use `ProcessedEvent` table to deduplicate by `eventId`.
- **Never import from another app** — all communication is via Kafka or HTTP (from frontends).
- **Cache keys follow** `catalog:v1:<type>:<id>` pattern via `CatalogCacheKeys` in `src/cache/catalog-cache.ts`.
- **Do NOT run migrations here** — run `pnpm --filter @repo/catalog-db db:migrate` from root.
- **Do NOT edit generated code** — `packages/catalog-db/generated/prisma/**` is gitignored.
- **Kafka envelope**: always `producer.send(topic, { value: payload })` and read `message.value`.
- **No product writes** — catalog-service only projects events; all mutations go through `product-service`.
- **Pricing is display-only** — catalog shows prices but is not the pricing authority.
- **Inventory is a read model** — availability status is projected from `inventory-service` events, never queried live.

## 8. Gap Analysis (vs recommended architecture)

### Already implemented ✅

- ✅ Fastify 5 + TypeScript + ESM + Prisma + PostgreSQL + Redis + Kafka + Zod + Prometheus
- ✅ Product read model (`CatalogProduct`, variants, category links)
- ✅ Category read model with hierarchy + product counts
- ✅ Brand read model (DB-backed, not yet event-driven)
- ✅ Collection read model with `collection_products` positioning
- ✅ Product-card read model with badges, pricing, availability, brand, category
- ✅ Redis cache-aside for: product cards, category pages, category tree, brand, collections, featured, new-arrivals, best-sellers
- ✅ Kafka consumers: `product.*`, `category.*`, `inventory.adjusted/restocked/low_stock`
- ✅ Idempotent projectors with `ProcessedEvent` dedup
- ✅ Prometheus metrics: HTTP requests, request duration, cache hits/misses/errors, catalog events consumed
- ✅ Health endpoints: `/health`, `/ready` (DB + Redis), `/metrics`
- ✅ Storefront overview composition (hero collections + sections + categories)
- ✅ Merchandised carousels: featured, new-arrivals, best-sellers
- ✅ Price/discount computation in projector
- ✅ Availability status projected from inventory events

### Gaps to close ⏳

1. **Brand events not consumed.** `brand.created` / `brand.updated` Kafka handlers don't exist.
   Brands are currently only populated via product events (which carry `brandId`). If `product-service`
   publishes brand events, add a `brand.consumer.ts` + `brand-projector.ts`.

2. **Collection events not consumed.** `collection.created` / `collection.updated` / `collection.deleted`
   Kafka handlers don't exist. Collections are currently only populated via product events. If the
   admin/merchandising tool publishes collection events, add a `collection.consumer.ts` installer in
   `consumers/index.ts` and wire it to `CollectionProjector`.

3. **Pricing events not consumed.** `pricing.updated` is listed as a recommended topic but not subscribed.
   Currently price changes flow through `product.updated`. If `product-service` emits dedicated pricing
   events, add a consumer that calls `ProductProjector.projectInventoryUpdate`-style price-only update.

4. **Review events not consumed.** `review.created` is listed as a recommended topic but not subscribed.
   Rating/review count currently only updates via `product.updated`. If review events exist, add a
   consumer that increments `rating`/`reviewCount` on the `CatalogProduct` read model.

5. **Brand cache invalidation gap.** `invalidateProductCache` clears brand keys when a product changes,
   but there's no corresponding invalidation when a brand itself is updated (name/logo/description).
   Once brand events are consumed, add `invalidateBrandCache(brandId)` and call it from the brand projector.

6. **Category tree cache invalidation breadth.** `invalidateCategoryCache` only clears page 1 and 2.
   If a category has many products across pages 3+, those pages stay stale until TTL. Consider clearing
   all pages for that category, or using a category-level wildcard invalidation if `@repo/redis` supports it.

7. **No brand projection in product projector.** When a `product.updated` event changes `brandId`,
   the old brand's product-count impression is not decremented and the new brand's is not incremented
   (there is no brand product-count field today, so this is informational — only relevant if brands
   ever expose a product count).

8. **Collection product orphan cleanup.** `CollectionProjector` links products but never removes
   products that were removed from a collection in an update event (the event would need to send the
   full new positions list, and the projector would need to delete stale `catalogCollectionProducts`).

## 9. Commands

```bash
pnpm --filter catalog-service dev         # Start dev server with hot reload
pnpm --filter catalog-service check-types # TypeScript type-check
pnpm --filter @repo/catalog-db db:generate # Generate Prisma client
pnpm --filter @repo/catalog-db db:migrate  # Apply migrations
```
