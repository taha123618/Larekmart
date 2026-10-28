# AGENTS.md — apps/search-service (Search, Filtering, Autocomplete & Indexing)

Scope: `apps/search-service` only. Root rules still apply — start there.

## What this service is

A dedicated search and indexing microservice for Larekmart built with Node.js, Fastify, OpenSearch, Redis, and Kafka. It synchronizes catalog data asynchronously from Kafka events (`product.created`, `product.updated`, `product.deleted`), builds denormalized search indices in OpenSearch with multi-fields and edge-ngram analyzers, serves low-latency cached full-text search, filtering, faceted aggregations, and autocomplete suggestions, and provides zero-downtime alias-based reindexing.

## Where things live

- `src/server.ts` — Fastify bootstrap, OpenSearch index initialization, Kafka subscriptions, Redis connection, and graceful shutdown on port `8006`.
- `src/config/` — Strongly-typed Zod environment validation (`env.ts`) and central runtime configuration (`config.ts`).
- `src/opensearch/client.ts` — OpenSearch client singleton (wraps `@repo/opensearch`), ping check, and shutdown.
- `src/utils/redis.ts` — Redis client singleton and key builder (wraps `@repo/redis`).
- `src/cache/` — normalized query hash caching (`search-cache.ts`) and autocomplete cache (`suggestion-cache.ts`).
- `src/services/` — Business orchestration for search (`search.service.ts`), suggestions (`suggestion.service.ts`), document indexing (`indexing.service.ts`), in-flight mutation drift reconciliation (`drift-reconciler.ts`), and blue/green alias-based reindexing with 1-click rollback (`reindex.service.ts`).
- `src/consumers/` — Product event handlers (`product-events.consumer.ts`) using `@repo/kafka` directly.
- `src/routes/` — Fastify route modules (`search.ts`, `suggestions.ts`, `indexing.ts`, `health.ts`).
- `src/controllers/` — Request handlers validating parameters with Zod.
- `src/middleware/` — Rate limiting (`rate-limit.ts`), Clerk admin auth (`auth.ts`), and global error handling (`error-handler.ts`).
- `src/observability/` — Metrics registry (`metrics.ts`) and OpenTelemetry tracing (`tracing.ts`).

## Reindexing, Aliasing & Drift Reconciliation

- Reindexing executes asynchronously (`POST /api/v1/index/reindex?async=true`) to avoid gateway proxy timeouts.
- `DriftReconciler` (`src/services/drift-reconciler.ts`) intercepts live mutations during reindexing, dual-writes to the pending target index, buffers any transient errors, and drains them before the alias cutover to guarantee zero lost mutations.
- Parity verification gate (`verifyIndexParity`) compares document count deltas and tests search query sanity before allowing the alias swap.
- Atomic alias swap (`atomicAliasSwap`) switches read/write aliases in a single OpenSearch call without dropping older indices, enabling instantaneous 1-click rollback via `POST /api/v1/index/alias/rollback`.

## OpenSearch ownership

- All OpenSearch SDK access lives in `@repo/opensearch`; this service only binds its client,
  logger, and config. Do not import `@opensearch-project/opensearch` here.
- search-service owns index **writes** (Kafka consumers) and the alias lifecycle. Other
  services (e.g. product-service) may read the index through the same package.

## Redis ownership

- All Redis access goes through `@repo/redis`; this service only binds the client and its key
  namespace. Do not import `ioredis` here.
- `src/utils/redis.ts` declares the service handle with `createRedisService` and owns the
  `search:v1:` namespace. Compose keys with `redis.keys` — never hand-write the prefix, or the
  same logical key ends up under two names.
- Consumers use `redis.client` with the package helpers, `redis.ping()` for `/ready`, and
  `redis.close()` on shutdown. `src/observability/metrics.ts` owns the logger, the metrics
  registry, and the shared cache counters (`cache_hits_total` / `cache_misses_total` /
  `cache_errors_total`), created with `createCacheMetrics`. Reads go through `cacheRead` so the
  outcome can be classified; an unreachable Redis is counted as an **error, not a miss**.
- Caching is best-effort: a Redis outage must degrade to cache misses, never to a failed request.
  `/ready` reports Redis as `degraded`, and the rate limiter fails open.

## Framework and style

- Fastify 5 on port `8006`.
- TypeScript Strict mode enabled.
- ESM (`"type": "module"`).
- Local imports use explicit `.js` extensions.
- Validates all request queries, bodies, and Kafka payloads using Zod schemas.

## Kafka integration

- Uses `@repo/kafka` client and consumer wrapper.
- Consumer group: `search-service-group`.
- Topics subscribed:
  - `product.created`: Indexes new product document into OpenSearch.
  - `product.updated`: Updates existing document in OpenSearch.
  - `product.deleted`: Removes product document from OpenSearch index.
  - `product.rating-summary.updated`: Partially updates rating and reviewCount in the OpenSearch document.
- Automatically invalidates Redis search cache namespace on index mutations.

## Verification

- `pnpm --filter search-service check-types`
- `pnpm check-types`
