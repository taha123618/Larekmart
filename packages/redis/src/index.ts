/**
 * `@repo/redis`
 *
 * Single shared source of truth for Redis across the Larekmart monorepo:
 * a client factory, typed cache helpers, namespace-versioned invalidation,
 * a key builder, and a rate limiter.
 *
 * Usage in a service — `createRedisService` binds the connection, the key
 * namespace, health, and shutdown in one call:
 *
 * ```ts
 * import { createRedisService, cacheRead, cacheSet, checkRateLimit } from "@repo/redis";
 *
 * export const redis = createRedisService({
 *   url: "redis://localhost:6379",
 *   keyPrefix: "myservice:v1:",
 *   serviceName: "my-service",
 *   logger,
 * });
 *
 * await cacheSet(redis.client, redis.keys.simple("health"), { ok: true }, 30);
 * const { status, value } = await cacheRead(redis.client, redis.keys.namespace("product", 42));
 * if (status === "error") metrics.cacheErrors.inc();   // Redis, not the data
 * if (status === "miss") metrics.cacheMisses.inc();    // cold cache
 * await redis.close();
 * ```
 *
 * The lower-level functions below (`createRedisClient` + `createKeyBuilder`, or
 * the raw helpers with an explicit client) remain available for scripts and
 * tests that do not need a service handle.
 */

// Per-service facade (preferred entry point for services)
export { createRedisService } from "./service.js";
export type { RedisService, RedisServiceOptions } from "./service.js";

// Client management
export {
  createRedisClient,
  closeRedisClient,
  closeAllRedisClients,
  checkRedisConnection,
} from "./client.js";

// Rate limiting
export { checkRateLimit } from "./rate-limit.js";

// Cache helpers
export {
  cacheRead,
  cacheSet,
  cacheDel,
  cacheIncr,
  cacheExpire,
  bumpNamespaceVersion,
  getNamespaceVersion,
} from "./cache.js";
export type { CacheReadResult, CacheReadStatus } from "./cache.js";

// Key builder & Cluster hash tags
export {
  createKeyBuilder,
  crc16,
  createClusterHashTag,
  createTenantWarehouseHashTag,
  extractClusterHashTag,
  calculateClusterSlot,
  DEFAULT_TENANT_ID,
  TENANT_WAREHOUSE_TAG_PATTERN,
} from "./key-builder.js";
export type { KeyBuilder } from "./key-builder.js";

// Redis Cluster Cross-Slot & Hash Tag Validation Guardrails
export {
  CrossSlotValidationError,
  InvalidHashTagError,
  validateClusterHashTag,
  assertClusterSlotAlignment,
  evalClusterSafe,
  evalTenantWarehouseSafe,
} from "./cluster-validator.js";
export type { ClusterSlotAlignmentOptions } from "./cluster-validator.js";

// Idempotency engine
export {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_RETENTION_TTL_SEC,
} from "./idempotency.js";
export type {
  IdempotencyState,
  IdempotentResponse,
  StoredIdempotencyRecord,
  AcquireLockResult,
  IdempotencyOptions,
} from "./idempotency.js";

// Distributed cluster lock & Redlock consensus
export {
  acquireClusterLock,
  releaseClusterLock,
  renewClusterLock,
  acquireRedlockConsensus,
  releaseRedlockConsensus,
  renewRedlockConsensus,
  withClusterLock,
  withRedlockConsensus,
} from "./cluster-lock.js";
export type {
  ClusterLockOptions,
  RedlockOptions,
  RedlockLease,
} from "./cluster-lock.js";

// Distributed leader election framework
export {
  DistributedLeaderElector,
  LeaderElection,
  LeaderFencingError,
} from "./leader-election.js";
export type { LeaderElectionOptions, LeaderInfo } from "./leader-election.js";

// Shared types
export type {
  RedisClientConfig,
  RedisLogger,
  RateLimitOptions,
  RateLimitResult,
} from "./types.js";

/**
 * The underlying ioredis client type, re-exported so consumers never need
 * `ioredis` in their own `package.json` just to annotate a variable.
 */
export type { Redis } from "ioredis";
