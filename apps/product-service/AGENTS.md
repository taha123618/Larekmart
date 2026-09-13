# AGENTS.md — apps/product-service (catalog)

Scope: `apps/product-service` only. Root rules still apply — start there.

## What this service is

Express 5 service on `:8000`. It owns the product and category catalog with Prisma and
PostgreSQL. It publishes `product.created` and `product.deleted` for Stripe sync, and
exposes a read-only OpenSearch-backed search endpoint (`GET /products/search`) through
`@repo/opensearch`.

## Where things live

- `src/index.ts` — server bootstrap, middleware, routes, health, and test routes.
- `src/routes/` — Express routers: `product.route.ts`, `category.route.ts`.
- `src/middleware/` — auth middleware (`shouldBeUser`, `shouldBeAdmin`) via
  `@clerk/express`.
- `src/controllers/` — product controller with create/list/update/delete logic and
  Kafka publishing; `search.controller.ts` for the OpenSearch read path.
- `src/search/` — OpenSearch client singleton (`client.ts`) built on `@repo/opensearch`, the
  shared product→event payload mapper (`product-payload.ts`), and the index backfill
  (`backfill.ts`).
- `src/scripts/` — one-off operational scripts, run with tsx (e.g. `backfill:search`).
- `src/utils/` — any service-level helpers.

## Framework and style

- Express 5, ESM (`"type": "module"`).
- Local imports use explicit `.js` extensions in files that already do; match the file you
  are editing rather than mixing styles inside one file.
- Route shape mirrors existing files: `router.get/post/put/delete` on a `Router`, then mount
  it on the app.
- Shared auth middleware names are fixed: `shouldBeUser` and `shouldBeAdmin`. Do not invent
  new guard names.

## Auth and authorization

- Clerk via `@clerk/express`: `getAuth` for token validation, `clerkMiddleware` for session
  setup.
- Admin-only mutations use `shouldBeAdmin`: `PUT /products/:id`, `DELETE /products/:id`,
  `POST/PUT/DELETE /categories/...`.
- **Known gap:** `POST /products` is currently unguarded. If you touch product creation,
  review whether it should become admin-only and align with the rest of the mutation routes.

## Persistence

- Prisma via `@repo/product-db`. Do not create ad-hoc DB Clients or bypass the generated
  client.
- Do not edit `packages/product-db/generated/**`. Change the Prisma schema and regenerate.
- Models of interest: `Product`, `Category`.

## Events

- Publish Kafka events through `@repo/kafka`, not raw `kafkajs`.
- Use the `{ value: payload }` envelope and let the consumer handle parsing.
- Current topics from this service: `product.created`, `product.updated`, `product.deleted`.
- `product.created` publishes `ProductCreatedPayload` — the full product, a superset of
  `StripeProductType`. payment-service mirrors `id`/`name`/`price` into Stripe and
  search-service indexes the image/size/colour fields, so keep both consumers in mind when
  changing it.
- If you change a payload, update the producer, every consumer, `@repo/types`, and
  `docs/EVENT-DRIVEN-ARCHITECTURE.md` together.

## Search read path

- `GET /products/search` reads the shared product index via `@repo/opensearch`
  (`searchProductDocuments`); query params are validated with `SearchQueryParamsSchema`.
- **Read-only.** The index is written by search-service from Kafka events — never index,
  update, or delete documents from product-service, and never import
  `@opensearch-project/opensearch` directly.
- Config comes from `OPENSEARCH_NODE`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`,
  `OPENSEARCH_ALIAS`, `OPENSEARCH_REQUEST_TIMEOUT` (see `.env.example`).

## Caching

- All Redis access goes through `@repo/redis`; `src/utils/redis.ts` declares the handle with
  `createRedisService`, and `src/cache/catalog-cache.ts` holds the catalog cache. Do not import
  `ioredis` here.
- Use `redis.client` with the `cacheRead`/`cacheSet` helpers and `redis.keys` to compose keys.
  Cache counters (`cache_hits_total` / `cache_misses_total` / `cache_errors_total`, `cache_type`
  labels) come from `createCacheMetrics` in `src/observability/metrics.ts`, which also owns the
  service logger and metrics registry, and surface at `/metrics`. Read through `cacheRead` so the
  outcome can be classified — an unreachable Redis is an **error, not a miss**.
- Cached (read-through): `GET /products`, `GET /products/:id`, `GET /categories`.
- **Invalidate on every write.** `createProduct`/`updateProduct`/`deleteProduct` and the
  category mutations call `invalidateCatalogCache()`, which bumps the `product:v1:` namespace
  version so all previously cached keys become unreachable at once. A new mutation path must
  call it too, or the storefront serves a stale catalog until the TTL expires.
- Never cache a miss: `getProduct` returns `null` for an unknown id, and caching that would hide
  a real value behind the TTL once the product exists.
- Redis is optional: misses fall through to Prisma, and `/health` reports Redis as `degraded`
  rather than failing the service.
- Config: `REDIS_URL`, `REDIS_KEY_PREFIX`, `PRODUCT_CACHE_TTL_SECONDS`,
  `CATEGORY_CACHE_TTL_SECONDS` (see `.env.example`).

## Search index backfill

- `pnpm --filter product-service backfill:search` republishes every catalog product as a
  `product.updated` event, so search-service rebuilds each document with `images`, `sizes`,
  and `colors`. Documents written before `product.created` carried the full product are
  missing exactly those fields, which is what breaks suggestion thumbnails and the
  colour/size facets.
- Flags: `--batch-size=N`, `--limit=N`, `--after-id=N` (resume an interrupted run),
  `--dry-run` (count without publishing).
- `POST /products/backfill-search` (admin) runs the same sweep over HTTP for the admin
  dashboard. It is **windowed**: a call stops at its `timeBudgetMs` budget and returns
  `hasMore` + `nextAfterId` for the caller to continue, so no request outlives its timeout.
- Both entry points share `backfillSearchIndex`. The HTTP path passes
  `manageProducerConnection: false` because the running service already owns a connected
  Kafka producer — disconnecting it would break `product.created`/`product.updated`
  publishing for every later request.
- `product.updated` is consumed **only** by search-service, so a full replay has no side
  effects on other services. The index write still happens in search-service — the backfill
  never indexes directly and needs no database access there.
- Run it with Kafka reachable and search-service up (or with its consumer able to catch up
  afterwards); the run is idempotent, so re-running is safe.
- Payloads come from `src/search/product-payload.ts`, which `POST /products` also uses, so a
  freshly created product and a replayed one produce identical search documents.

## Error handling

- Return `{ message }` JSON with the correct status code.
- Use the existing global error handler pattern in the Express service; do not leak internals
  in production responses.
- Async work (including publishing) should not crash the request path silently; log failures
  where appropriate.

## Health and observability

- Expose `GET /health` returning `{ status, uptime, timestamp }`.
- Logging is `console.log`/`console.error`. Keep it structured and sparse.

## What not to do

- Do not add a second framework.
- Do not access MongoDB or order data here.
- Do not import frontend code.
- Do not hardcode service URLs or secrets outside env vars.

## Verification

- `pnpm --filter product-service check-types`
- After Prisma changes: `pnpm --filter @repo/product-db db:generate` then `pnpm check-types`
  from root.
- Manual flows against running Postgres + Kafka.
- No test runner exists yet.
