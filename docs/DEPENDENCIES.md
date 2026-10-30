# Package dependencies

The monorepo is a directed graph with a single rule: **dependencies point outward from
applications to packages, never the other way.** Packages never import application code,
and applications never import each other.

## Graph

```
apps/client ─┐
             ├─▶ @repo/types ─┬─▶ @repo/product-db ─▶ @prisma/client ─▶ PostgreSQL
apps/admin ──┘                └─▶ @repo/order-db   ─▶ mongoose      ─▶ MongoDB

apps/product-service ─┬─▶ @repo/product-db
                      ├─▶ @repo/kafka ─▶ kafkajs
                      ├─▶ @repo/opensearch ─▶ @opensearch-project/opensearch ─▶ OpenSearch
                      ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                      └─▶ @repo/types

apps/inventory-service ─▶ @repo/inventory-db ─▶ @prisma/client ─▶ PostgreSQL

apps/order-service ───┬─▶ @repo/order-db
                      ├─▶ @repo/kafka
                      ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                      └─▶ @repo/types

apps/payment-service ─┬─▶ @repo/kafka
                      ├─▶ @repo/types
                      └─▶ stripe

apps/auth-service ────┬─▶ @repo/kafka
                      └─▶ @clerk/express

apps/email-service ───┬─▶ @repo/kafka
                      └─▶ @repo/types

apps/analytic-service (Go) ┬─▶ Kafka (segmentio/kafka-go)
                           ├─▶ PostgreSQL (jackc/pgx/v5 - pgxpool)
                           ├─▶ Redis (redis/go-redis/v9)
                           └─▶ Prometheus (prometheus/client_golang)

apps/notification-service (Go) ┬─▶ Kafka (segmentio/kafka-go)
                               ├─▶ PostgreSQL (pgxpool)
                               └─▶ Redis (go-redis)

apps/search-service ──────┬─▶ @repo/opensearch ─▶ @opensearch-project/opensearch ─▶ OpenSearch
                          ├─▶ @repo/kafka
                          ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                          └─▶ @repo/types

apps/recommendation-service (Python) ┬─▶ Kafka (aiokafka)
                                     ├─▶ PostgreSQL + pgvector (asyncpg)
                                     ├─▶ Redis (redis-py + Celery broker)
                                     └─▶ @repo/types (contracts mirror)

apps/cart-service ─────────┬─▶ @repo/cart-db ─▶ mongoose ─▶ MongoDB
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           └─▶ @repo/types

apps/user-service ─────────┬─▶ @repo/user-db ─▶ @prisma/client ─▶ PostgreSQL
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/media-service ────────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (media_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           ├─▶ @repo/types
                           ├─▶ @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner ─▶ S3/MinIO
                           └─▶ sharp (worker image processing)

apps/review-service ────────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (review_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/wishlist-service ──────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (larekmart_wishlist_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/promotion-service ─────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (larekmart_promotion_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/tax-service ───────────┬─▶ drizzle-orm + mysql2 ─▶ MySQL (tax_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/return-service ────────┬─▶ drizzle-orm + mysql2 ─▶ MySQL (return_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/pricing-service ───────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (pricing_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/vendor-service ────────┬─▶ @repo/vendor-db ─▶ @prisma/client ─▶ PostgreSQL (larekmart_vendor_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/seller-service ────────┬─▶ drizzle-orm + pg ─▶ PostgreSQL (larekmart_seller_db)
                           ├─▶ @repo/kafka
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/api-gateway ──────────┬─▶ @fastify/http-proxy
                           ├─▶ @repo/redis ─▶ ioredis ─▶ Redis
                           ├─▶ @repo/monitoring
                           └─▶ @repo/types

apps/admin, apps/client ─▶ @repo/eslint-config, @repo/typescript-config
all workspaces          ─▶ @repo/typescript-config, @repo/monitoring
```

## Package roles

| Package                   | Kind         | Depends on                                                          | Public surface                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@repo/monitoring`**    | leaf utility | —                                                                   | `createLogger`, `createHealthRegistry`, `createMetricsRegistry`, `createCounter`, `createHistogram`, `createCacheMetrics`, `measureAsync`                                                                                                                                                                                                                                                               |
| `@repo/kafka`             | leaf utility | `kafkajs`                                                           | `createKafkaClient`, `createProducer`, `createConsumer`                                                                                                                                                                                                                                                                                                                                                 |
| `@repo/redis`             | leaf utility | `ioredis`                                                           | `createRedisService`, `createRedisClient`, `createKeyBuilder`, `Redis` (client type), `cacheRead`, `cacheSet`, `cacheDel`, `cacheIncr`, `cacheExpire`, `bumpNamespaceVersion`, `getNamespaceVersion`, `checkRateLimit`, `checkRedisConnection`, `closeRedisClient`, `closeAllRedisClients`                                                                                                              |
| `@repo/opensearch`        | leaf utility | `@opensearch-project/opensearch`, `@repo/types`, `@repo/monitoring` | `createOpenSearchClient`, `pingOpenSearch`, `Client`, `ensureProductIndexExists`, `pointAliasToIndex`, `createNewVersionedIndex`, `PRODUCT_INDEX_SETTINGS`, `buildProductSearchQuery`, `buildSearchFilters`, `buildAutocompleteQuery`, `searchProductDocuments`, `bulkIndexProducts`, `indexProductDocument`, `updateProductDocument`, `getProductDocument`, `deleteProductDocument`, `reindexProducts` |
| `@repo/types`             | contract     | `@repo/product-db`, `@repo/order-db`, `zod`                         | API/domain types, Zod schemas, constants                                                                                                                                                                                                                                                                                                                                                                |
| `@repo/product-db`        | persistence  | `@prisma/client`                                                    | `prisma` client + generated Prisma types                                                                                                                                                                                                                                                                                                                                                                |
| `@repo/inventory-db`      | persistence  | `@prisma/client`                                                    | `prisma` client, inventory/reservation/ledger models, and transactional stock operations                                                                                                                                                                                                                                                                                                                |
| `@repo/order-db`          | persistence  | `mongoose`                                                          | `Order` (hashed sharding on `{ userId: "hashed" }` + scatter-gather mitigation indexes), `OutboxEvent` (transactional outbox with 7-day TTL), `createOutboxEvent`, `OrderStatus`, `OrderSchemaType`, `connectOrderDB`                                                                                                                                                                                   |
| `@repo/cart-db`           | persistence  | `mongoose`                                                          | `Cart`, `ProcessedEvent`, `ICart`, `ICartItem`, `ICartCoupon`, `ICartAdjustment`, `ICartPricing`, `ICartPricingSnapshot`, `CartStatus`, `connectCartDB`                                                                                                                                                                                                                                                 |
| `@repo/catalog-db`        | persistence  | `@prisma/client`                                                    | Prisma catalog schema with dual client exports (`readPrisma` for read-replicas & `prisma` for primary writes) for catalog read projections                                                                                                                                                                                                                                                              |
| `@repo/shipping-db`       | persistence  | `@prisma/client`                                                    | Prisma shipping schema, shipments, methods, carrier tracking events and packages                                                                                                                                                                                                                                                                                                                        |
| `@repo/user-db`           | persistence  | `@prisma/client`                                                    | Prisma user schema, profiles, addresses, preferences, settings, and idempotency events                                                                                                                                                                                                                                                                                                                  |
| `@repo/vendor-db`         | persistence  | `@prisma/client`                                                    | Prisma vendor schema, business profiles, KYB documents, verifications, members, and status history                                                                                                                                                                                                                                                                                                      |
| `@repo/eslint-config`     | config       | eslint plugins                                                      | `base`, `next-js`, `react-internal`                                                                                                                                                                                                                                                                                                                                                                     |
| `@repo/typescript-config` | config       | —                                                                   | `base.json`, `nextjs.json`, `react-library.json`                                                                                                                                                                                                                                                                                                                                                        |

## Boundary rules

1. **No app → app imports.** Shared behavior belongs in a package. This keeps the two
   frontends and the services independently deployable.
2. **No package → app imports.** Packages must not know their consumers.
3. **Contracts in `@repo/types`.** If two workspaces need the same type or schema, it
   lives here — not copied into each.
4. **Persistence is owned by its db package.** Only `product-service` imports
   `@repo/product-db` at runtime; only `order-service` imports `@repo/order-db`.
   `@repo/types` is the deliberate exception: it imports **types** from both so it can
   re-export domain shapes. Keep that coupling type-only — do not introduce runtime
   imports or cycles there.
5. **Internal references use `workspace:*`.**
6. **Kafka is the only service-to-service channel.** No HTTP client between backends.

## Watch-outs

- The Redis key namespace is applied by the `@repo/redis` handle
  (`createRedisService` → `keys`), never by the client. Handing an already-prefixed key to
  a cache helper double-prefixes it (`search:v1:search:v1:...`) and quietly creates a
  second keyspace.
- `@repo/types` sits on top of both database packages. Adding runtime logic there that
  pulls in Prisma/Mongoose would drag database clients into frontend bundles. Prefer
  `import type` for the persistence-derived types.
- In several `package.json` files `@repo/types` is listed under `devDependencies` even
  though it is used in application code. When adding a genuinely runtime dependency,
  declare it in `dependencies` so bundlers and deployments resolve it correctly.
- `@repo/types`' `package.json` has a stale `"main": "src/index/ts"` field; consumers
  resolve through the `exports` map instead. Don't rely on `main`.
- Removing or renaming a package export is a breaking change for every consumer. Grep
  the repo for the symbol before changing the surface.

## Checking the graph

There is no automated boundary linter. Verify manually:

```bash
# who imports a package
grep -rn "@repo/types" apps packages --include=*.ts --include=*.tsx -l
```

`pnpm check-types` will catch missing exports and type breaks across dependents, and
Turborepo orders `check-types`/`build` by dependency (`dependsOn: ["^build"]`).
