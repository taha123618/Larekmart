# AGENTS.md — `packages/redis` (`@repo/redis`)

Scope rules for AI coding agents working in this package.

## 1. Purpose

`@repo/redis` is the **single shared source of truth** for Redis access across the Larekmart monorepo. It exposes:

- A per-service **facade** (`createRedisService`) that binds the connection, the namespaced key builder, the health probe, and shutdown into one handle — this is the entry point services should use
- A connection **factory** (`createRedisClient`) with one client per URL per process, plus `closeRedisClient` / `closeAllRedisClients`
- A **health probe** (`checkRedisConnection`)
- **Typed cache helpers** (`cacheRead`, `cacheSet`, `cacheDel`, `cacheIncr`, `cacheExpire`)
- **Outcome-reporting reads.** `cacheRead` returns `{ status: "hit" | "miss" | "error", value }` instead of a bare `null`, so callers can count an unreachable Redis separately from a cold cache
- **Namespace-versioned bulk invalidation** (`bumpNamespaceVersion`, `getNamespaceVersion`)
- A **key builder** (`createKeyBuilder`) that owns service key prefixes
- A **fixed-window rate limiter** (`checkRateLimit`)
- A **distributed idempotency engine** (`acquireIdempotencyLock`, `commitIdempotencyResponse`, `releaseIdempotencyLock`)
- The re-exported ioredis `Redis` client type

## 2. What belongs here

| ✅ Belongs                                        | ❌ Does NOT belong                                 |
| ------------------------------------------------- | -------------------------------------------------- |
| Client creation, reconnect/retry policy, shutdown | Service-specific config values (env vars)          |
| The per-service facade (`RedisService`)           | Domain cache key formats and TTLs                  |
| Generic cache get/set/delete/incr helpers         | Product/search/analytics key formats               |
| Rate-limit algorithm                              | HTTP route wiring or Fastify/Express middleware    |
| Namespace-version invalidation primitive          | Kafka event handling                               |
| The ioredis client type re-export                 | Metrics counters (pass a `logger`, not a registry) |

## 3. Dependency rules

- The package depends only on `ioredis`. It is a **leaf utility** — it must never import from `apps/*`, and it does not import `@repo/monitoring`.
- The optional logger parameter is a structural port (`RedisLogger` in `src/types.ts`): `@repo/monitoring`'s `Logger` satisfies it, as does `console`. Change that interface only if `Logger` itself changes.

## 4. API design principles

- **Two layers, one implementation.** `createRedisService` is the service-facing facade; `createRedisClient`/`createKeyBuilder`/the helpers are the primitives it composes. Add behaviour to the primitives and surface it through the facade — never re-implement the singleton wiring inside a service.
- **Prefix ownership is explicit.** `createRedisClient` is prefix-agnostic; `createRedisService`/`createKeyBuilder` is the only place a namespace prefix is applied. Do not add a `keyPrefix` client option — it previously existed and silently did nothing, which produced keys nobody expected.
- **No global config singletons.** Callers pass their own URL, service name, and logger.
- **Retry/backoff is a package default** (5 attempts, 2 s cap). A service should not re-declare it — override `maxRetries`/`maxRetryDelayMs` only for a measured reason.
- **Best-effort reads and writes.** The helpers in `cache.ts` never throw, so an outage degrades to a miss; `checkRateLimit` deliberately throws so callers can choose to fail open or closed. Keep that split.
- **Reads report their outcome, and `error` is not `miss`.** `cacheRead` exists so a caller can tell "nothing cached" from "Redis unreachable"; both used to surface as `null`, which made an outage look like a 0% hit rate. Any metric that counts cache reads must keep those three outcomes distinct (see `@repo/monitoring`'s `createCacheMetrics`). Prefer `cacheRead` over a raw `GET` anywhere the result is measured.
- **Never leave a key without a TTL** in new helpers — a key with no expiry is an outage waiting to happen.
- **A bump must actually change the version — and must not grow faster than one per bump.** `bumpNamespaceVersion` advances the counter past the in-memory fallback on purpose: a plain `INCR` on the first bump returns `1`, which can equal the version readers already hold, silently turning the first invalidation into a no-op. It therefore increments by one and only jumps ahead (to exactly `fallback + 1`) when the stored value has fallen behind. Any change to that helper has to preserve two things: the returned version is strictly greater than both the stored value and the caller's fallback, **and** consecutive bumps advance by one. Adding `fallback + 1` on every call also satisfies the first rule but the offset compounds — it doubles the stored value each time and overflows Redis's 64-bit integer after ~63 bumps, after which every bump lands in the error path and the version stops advancing, silently disabling invalidation for a long-lived process. `verify:redis` pins both properties with a 70-bump run.

## 5. Adding a helper

1. Add the function to the relevant module (`cache.ts`, `rate-limit.ts`, `key-builder.ts`).
2. Export it (and any new types) from `src/index.ts`.
3. Keep it generic — if it knows a domain noun like "product", it belongs in a service.
4. If it changes the key format, update every service that reads those keys and note the migration in the PR.

## 6. Local infrastructure

- `packages/redis/docker-compose.yml` runs a single Redis 7 instance on
  `localhost:6379` (the address every service's `REDIS_URL` defaults to).
- Start it with `docker compose -f packages/redis/docker-compose.yml up -d`.
- Redis is a **cache**, not a source of truth here: data does not need to survive a
  restart, and every service is written to serve from PostgreSQL/OpenSearch when it is
  unavailable. Do not add persistence requirements to this compose file.

## 7. Verification

```bash
pnpm --filter @repo/redis check-types
pnpm --filter @repo/redis verify:redis   # needs a running Redis (see §6)
```

`verify:redis` (`src/scripts/verify-redis.ts`) is the regression guard for the behaviour type
checking cannot see: key namespacing, cache TTLs, the three read outcomes (`hit` / `miss` /
`error` — an undecodable payload must be a miss, an unreachable server an error), the
namespace-version bump, the rate limiter's guaranteed bucket TTL, and degraded behaviour when
Redis is unreachable. It runs against a real server, writes only under a run-scoped prefix,
deletes what it created, and exits non-zero on failure. **It is not part of `check-types` or
`build`** — run it whenever you touch `service.ts`, `client.ts`, `cache.ts`, `rate-limit.ts`, or
`key-builder.ts`.
