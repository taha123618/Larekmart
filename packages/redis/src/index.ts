/**
 * @repo/redis
 *
 * Shared Redis client factory, cache helpers, rate-limiting utilities, and
 * key-builder for Larekmart microservices.
 *
 * Usage in a service:
 *
 * ```ts
 * import {
 *   createRedisClient,
 *   closeRedisClient,
 *   checkRedisConnection,
 *   checkRateLimit,
 *   cacheGet,
 *   cacheSet,
 *   cacheDel,
 *   cacheIncr,
 *   bumpNamespaceVersion,
 *   getNamespaceVersion,
 *   createKeyBuilder,
 * } from "@repo/redis";
 *
 * const redis = createRedisClient({ url: "redis://localhost:6379", keyPrefix: "svc:" });
 * ```
 */

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
  cacheGet,
  cacheSet,
  cacheDel,
  cacheIncr,
  cacheExpire,
  bumpNamespaceVersion,
  getNamespaceVersion,
} from "./cache.js";

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
