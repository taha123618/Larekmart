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

// Key builder
export { createKeyBuilder } from "./key-builder.js";
export type { KeyBuilder } from "./key-builder.js";

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
