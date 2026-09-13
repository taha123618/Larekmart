# `@repo/redis`

Shared Redis infrastructure for Larekmart services. The package owns connection
creation, service key namespaces, typed cache helpers, namespace-versioned
invalidation, health probes, and fixed-window rate limiting.

## Public API

- `createRedisService(options)`: service facade containing a namespaced key builder,
  shared client, `ping()`, and `close()`.
- `createRedisClient`, `closeRedisClient`, `closeAllRedisClients`: per-URL client
  lifecycle helpers.
- `createKeyBuilder(prefix)`: builds keys under a normalized service prefix.
- `cacheRead`, `cacheSet`, `cacheDel`, `cacheIncr`, `cacheExpire`: best-effort typed
  cache operations. `cacheRead` distinguishes `hit`, `miss`, and `error`.
- `bumpNamespaceVersion`, `getNamespaceVersion`: bulk invalidation without scanning
  or deleting old keys.
- `checkRateLimit`: fixed-window rate limiting with a guaranteed bucket TTL.
- `checkRedisConnection` and the `Redis` client type.

Every service should use `createRedisService` and `redis.keys`; do not import
`ioredis` directly or hand-write a service prefix. Redis is optional at runtime:
cache reads fall through to the source of truth when Redis is unavailable.

## Local Redis

```bash
docker compose -f packages/redis/docker-compose.yml up -d
```

The compose file starts Redis 7 on `localhost:6379` without persistence. Cache data
is disposable and should expire through helper-provided TTLs.

## Integration verification

The opt-in verifier exercises the real server, including key namespacing, TTLs,
cache outcomes, namespace-version invalidation, rate limiting, and degraded behavior.
It uses a run-scoped prefix and cleans up its keys.

```bash
pnpm --filter @repo/redis check-types
pnpm --filter @repo/redis verify:redis
```

`verify:redis` requires Redis to be running and exits non-zero on any regression.
It is intentionally separate from the offline monorepo type-check and build tasks.
