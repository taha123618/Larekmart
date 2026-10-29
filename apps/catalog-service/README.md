# catalog-service

Read-optimized product discovery, merchandising, and storefront browsing microservice for **Larekmart**.

## Overview

`catalog-service` owns the CQRS **read models** for the storefront. It consumes `product.*`, `category.*`, and `inventory.*` Kafka events from upstream services and denormalizes them into fast, pre-computed product card read models stored in PostgreSQL. All storefront browsing queries go through this service (backed by Redis caching) rather than hitting `product-service` directly.

| Property  | Value                                                                                |
| --------- | ------------------------------------------------------------------------------------ |
| Port      | `8010`                                                                               |
| Runtime   | Fastify 5 + TypeScript                                                               |
| Database  | PostgreSQL (`@repo/catalog-db`, `readPrisma` for read-replicas, `prisma` for writes) |
| Cache     | Redis (`catalog:v1:` prefix via `@repo/redis`)                                       |
| Messaging | Kafka (`@repo/kafka`)                                                                |

## Architecture Boundary

```
product-service   ──Kafka──▶  catalog-service  ──HTTP──▶  client / admin
inventory-service ──Kafka──▶  (CQRS projectors, read models, caching)
```

**`product-service`** owns mutations (CRUD source of truth).  
**`catalog-service`** owns the read models (presentation layer, storefront browsing).

## API Routes

All routes are prefixed with `/api/v1/catalog`.

### Products

- `GET /products` — paginated product listing with filters (category, brand, price, sort, availability)
- `GET /products/:id` — single product card by UUID or slug

### Categories

- `GET /categories?tree=true` — hierarchical category tree
- `GET /categories` — flat category list
- `GET /categories/:id` — category detail with children
- `GET /categories/:id/products` — products for a category

### Brands

- `GET /brands` — all active brands
- `GET /brands/:id` — brand detail
- `GET /brands/:id/products` — products for a brand

### Collections & Merchandising

- `GET /collections` — all active curated collections
- `GET /collections/:id` — collection with ordered product cards
- `GET /featured` — featured products
- `GET /new-arrivals` — new arrivals
- `GET /best-sellers` — best sellers by rating/review count
- `GET /storefront` — full storefront overview for the homepage

### Health & Monitoring

- `GET /health` — liveness probe
- `GET /ready` — readiness (DB + Redis checks)
- `GET /metrics` — Prometheus metrics

## Environment Variables

| Variable                    | Default                  | Description                                                                                      |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `PORT`                      | `8010`                   | HTTP port                                                                                        |
| `HOST`                      | `0.0.0.0`                | Bind address                                                                                     |
| `NODE_ENV`                  | `development`            | Environment                                                                                      |
| `DATABASE_URL`              | —                        | PostgreSQL primary write connection string                                                       |
| `DATABASE_READ_REPLICA_URL` | —                        | PostgreSQL read-replica connection string (or PgBouncer port 6432; falls back to `DATABASE_URL`) |
| `REDIS_URL`                 | `redis://localhost:6379` | Redis connection string                                                                          |
| `REDIS_KEY_PREFIX`          | `catalog:v1:`            | Redis key namespace                                                                              |
| `KAFKA_BROKERS`             | `localhost:9092`         | Kafka broker addresses                                                                           |
| `KAFKA_CLIENT_ID`           | `catalog-service`        | Kafka client identifier                                                                          |
| `KAFKA_GROUP_ID`            | `catalog-service-group`  | Kafka consumer group                                                                             |
| `CATALOG_CACHE_TTL_SECONDS` | `3600`                   | Default cache TTL (1 hour)                                                                       |

## Development

```bash
# Generate Prisma client (required first)
pnpm --filter @repo/catalog-db db:generate

# Run migrations
pnpm --filter @repo/catalog-db db:migrate

# Dev server (hot reload)
pnpm --filter catalog-service dev

# Type check
pnpm --filter catalog-service check-types
```

## Project Structure

```
src/
├── config/env.ts              Zod env validation
├── observability/metrics.ts   Prometheus metrics + logger
├── cache/redis.ts             Cache keys and cache-aside helpers
├── utils/
│   ├── redis.ts               RedisService singleton
│   ├── kafka.ts               Producer + consumer singletons
│   └── mappers.ts             Prisma → CatalogProductCard mappers
├── repositories/              Raw Prisma queries
│   ├── catalog.repository.ts  Product listing, featured, new arrivals
│   ├── category.repository.ts Category tree builder
│   ├── brand.repository.ts    Brand listings
│   └── collection.repository.ts Collection queries
├── read-model/                CQRS Projectors (idempotent)
│   ├── product-projector.ts   Upserts CatalogProduct from Kafka events
│   ├── category-projector.ts  Upserts CatalogCategory hierarchy
│   └── collection-projector.ts Upserts CatalogCollection
├── services/                  Cache-aside business logic
│   ├── catalog.service.ts
│   ├── category.service.ts
│   ├── brand.service.ts
│   ├── collection.service.ts
│   └── merchandising.service.ts Storefront homepage composition
├── controllers/
│   └── catalog.controller.ts  Fastify request/reply handlers
├── routes/
│   ├── catalog.routes.ts      All /api/v1/catalog/* routes
│   └── health.routes.ts       /health, /ready, /metrics
├── consumers/
│   ├── index.ts               Kafka consumer registry
│   ├── product.consumer.ts    product.* handlers
│   ├── category.consumer.ts   category.* handlers
│   └── inventory.consumer.ts  inventory.* handlers
├── publishers/
│   └── catalog.publisher.ts   Outbound Kafka events
├── plugins/fastify.ts         CORS + error handler
├── server.ts                  Fastify app factory
└── index.ts                   Process entrypoint + graceful shutdown
```
