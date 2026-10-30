# `@repo/redis`

Shared Redis infrastructure for Larekmart services. The package owns connection
creation, service key namespaces, typed cache helpers, namespace-versioned
invalidation, health probes, fixed-window rate limiting, distributed idempotency leases,
cluster locks, 3-node Redlock consensus, and distributed leader election.

---

## Public API

- **Service Facade**:
  - `createRedisService(options)`: service facade containing a namespaced key builder, shared client, `ping()`, and `close()`.
  - `createRedisClient`, `closeRedisClient`, `closeAllRedisClients`: per-URL client lifecycle helpers.
  - `createKeyBuilder(prefix)`: builds keys under a normalized service prefix.
  - `checkRedisConnection`: health probe returning connectivity status and latency.
- **Typed Cache Operations**:
  - `cacheRead`, `cacheSet`, `cacheDel`, `cacheIncr`, `cacheExpire`: best-effort typed cache operations. `cacheRead` distinguishes `hit`, `miss`, and `error`.
  - `bumpNamespaceVersion`, `getNamespaceVersion`: bulk namespace invalidation without scanning or deleting old keys.
- **Rate Limiting**:
  - `checkRateLimit`: fixed-window rate limiting with guaranteed bucket TTL.
- **Distributed Mutation Idempotency**:
  - `acquireIdempotencyLock`, `commitIdempotencyResponse`, `releaseIdempotencyLock`: atomic leases enforcing `Idempotency-Key` headers on state mutations with response caching.
- **Distributed Cluster Locking & Redlock Consensus**:
  - `acquireClusterLock`, `releaseClusterLock`, `renewClusterLock`, `withClusterLock`: atomic distributed lock wrappers with automatic lease renewal.
  - `acquireRedlockConsensus`, `releaseRedlockConsensus`, `renewRedlockConsensus`, `withRedlockConsensus`: multi-node majority quorum distributed consensus across independent Redis instances.
- **Distributed Leader Election**:
  - `DistributedLeaderElector` / `LeaderElection`: continuous leader coordination with automatic heartbeat renewal, monotonically increasing `fencingToken` guards, and instant standby failover for background singletons (e.g. `order-service` outbox sweeper).
- **Cluster Sharding & Slot Pinning**:
  - CRC16 slot hash tagging support (e.g. `{tenant:warehouse}:sku`) ensuring co-located keys map to the same Redis cluster hash slot.
  - `assertClusterSlotAlignment(keys)`, `extractHashTag(key)`, `CrossSlotValidationError`: validates multi-key commands upfront to prevent runtime `CROSSSLOT` exceptions.
- **Read-Your-Writes Consistency Leases**:
  - `markReadYourWrites`, `isReadYourWritesActive`, `clearReadYourWrites`, `DEFAULT_RYW_TTL_MS`: registers and checks atomic 500ms client session leases to force edge/storefront reads to the primary database writer and bypass stale caches.

Every service should use `createRedisService` and `redis.keys`; do not import `ioredis` directly or hand-write a service prefix. Redis is optional at runtime: cache reads fall through to the source of truth when Redis is unavailable.

---

## Local Redis

```bash
docker compose -f packages/redis/docker-compose.yml up -d
```

The compose file starts Redis 7 on `localhost:6379` without persistence. Cache data is disposable and should expire through helper-provided TTLs.

---

## Verification & Testing

```bash
# Offline unit test suite (Cluster sharding, CRC16 hashing, Redlock consensus simulation, leader election)
pnpm --filter @repo/redis test

# Monorepo type check
pnpm --filter @repo/redis check-types

# Online integration verification (requires active Redis server on localhost:6379)
pnpm --filter @repo/redis verify:redis
```
