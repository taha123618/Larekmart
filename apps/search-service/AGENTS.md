# AGENTS.md — apps/search-service (Search, Filtering, Autocomplete & Indexing)

Scope: `apps/search-service` only. Root rules still apply — start there.

## What this service is

A dedicated search and indexing microservice for Larekmart built with Node.js, Fastify, OpenSearch, Redis, and Kafka. It synchronizes catalog data asynchronously from Kafka events (`product.created`, `product.updated`, `product.deleted`), builds denormalized search indices in OpenSearch with multi-fields and edge-ngram analyzers, serves low-latency cached full-text search, filtering, faceted aggregations, and autocomplete suggestions, and provides zero-downtime alias-based reindexing.

## Where things live

- `src/server.ts` — Fastify bootstrap, OpenSearch index initialization, Kafka subscriptions, Redis connection, and graceful shutdown on port `8006`.
- `src/config/` — Strongly-typed Zod environment validation (`env.ts`) and central runtime configuration (`config.ts`).
- `src/opensearch/client.ts` — OpenSearch client singleton (wraps `@repo/opensearch`), ping check, and shutdown.
- `src/cache/` — Redis client (`redis.ts`), normalized query hash caching (`search-cache.ts`), and autocomplete cache (`suggestion-cache.ts`).
- `src/services/` — Business orchestration for search (`search.service.ts`), suggestions (`suggestion.service.ts`), document indexing (`indexing.service.ts`), and alias-based reindexing (`reindex.service.ts`).
- `src/consumers/` — Product event handlers (`product-events.consumer.ts`) using `@repo/kafka` directly.
- `src/routes/` — Fastify route modules (`search.ts`, `suggestions.ts`, `indexing.ts`, `health.ts`).
- `src/controllers/` — Request handlers validating parameters with Zod.
- `src/middleware/` — Rate limiting (`rate-limit.ts`), Clerk admin auth (`auth.ts`), and global error handling (`error-handler.ts`).
- `src/observability/` — Metrics registry (`metrics.ts`) and OpenTelemetry tracing (`tracing.ts`).

## OpenSearch ownership

- All OpenSearch SDK access lives in `@repo/opensearch`; this service only binds its client,
  logger, and config. Do not import `@opensearch-project/opensearch` here.
- search-service owns index **writes** (Kafka consumers) and the alias lifecycle. Other
  services (e.g. product-service) may read the index through the same package.

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
- Automatically invalidates Redis search cache namespace on index mutations.

## Verification

- `pnpm --filter search-service check-types`
- `pnpm check-types`
