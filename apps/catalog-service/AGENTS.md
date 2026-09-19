# catalog-service — AGENTS.md

> Scope: `apps/catalog-service` and `packages/catalog-db`

## 1. Purpose

`catalog-service` is the **read-optimized product discovery** microservice. It owns the CQRS read
models for the storefront — product listing pages, category trees, brand pages, curated
collections, featured/new/best-seller carousels, and merchandising. It **does NOT** own authoritative
product mutations — those live in `product-service`.

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

## 3. Key Directories

```
apps/catalog-service/
├── src/
│   ├── config/env.ts            — Zod env validation
│   ├── observability/metrics.ts — Prometheus counters/histograms, logger
│   ├── cache/redis.ts           — CatalogCacheKeys, getCached/setCached helpers
│   ├── utils/
│   │   ├── redis.ts             — RedisService singleton
│   │   ├── kafka.ts             — producer + consumer singletons
│   │   └── mappers.ts           — Prisma → API read-model mappers
│   ├── repositories/            — Prisma queries (no business logic)
│   ├── read-model/              — CQRS Projectors (idempotent event handlers)
│   ├── services/                — Cache-aside retrieval + business rules
│   ├── controllers/             — Fastify request/reply handlers
│   ├── routes/                  — Fastify plugin route registrations
│   ├── consumers/               — Kafka consumer handlers + subscription registry
│   ├── publishers/              — Kafka producer helpers
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

| Topic                | Action                                              |
|----------------------|-----------------------------------------------------|
| `product.created`    | Upsert `CatalogProduct` read model + variants       |
| `product.updated`    | Update product read model, invalidate cache         |
| `product.deleted`    | Soft-delete (set `isActive=false`), invalidate cache|
| `category.created`   | Upsert `CatalogCategory` hierarchy                  |
| `category.updated`   | Update category, invalidate category-tree cache     |
| `category.deleted`   | Soft-delete category                                |
| `inventory.adjusted` | Update `availabilityStatus` on product read model   |
| `inventory.restocked`| Update `availabilityStatus` on product read model   |
| `inventory.low_stock`| Update `availabilityStatus` on product read model   |

## 6. Rules

- **Projectors are idempotent** — use `ProcessedEvent` table to deduplicate by `eventId`.
- **Never import from another app** — all communication is via Kafka or HTTP (from frontends).
- **Cache keys follow** `catalog:v1:<type>:<id>` pattern via `CatalogCacheKeys` in `src/cache/redis.ts`.
- **Do NOT` run migrations here** — run `pnpm --filter @repo/catalog-db db:migrate` from root.
- **Do NOT edit generated code** — `packages/catalog-db/generated/prisma/**` is gitignored.
- **Kafka envelope**: always `producer.send(topic, { value: payload })` and read `message.value`.

## 7. Commands

```bash
pnpm --filter catalog-service dev         # Start dev server with hot reload
pnpm --filter catalog-service check-types # TypeScript type-check
pnpm --filter @repo/catalog-db db:generate # Generate Prisma client
pnpm --filter @repo/catalog-db db:migrate  # Apply migrations
```
