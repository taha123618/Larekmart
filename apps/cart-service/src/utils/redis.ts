/**
 * Cart-service Redis handle.
 *
 * Everything Redis-related for this service is declared here once, through
 * `@repo/redis`'s per-service facade: the connection, the `cart:v1:` key
 * namespace, the health probe, and shutdown.
 *
 * - `redis.client` — pass to the package's cache helpers
 * - `redis.keys`   — compose keys (`redis.keys.simple(...)`)
 * - `redis.ping()` — health checks
 * - `redis.close()` — shutdown
 */
import { createRedisService } from "@repo/redis";
import type { RedisService } from "@repo/redis";
import { logger } from "../observability/metrics.js";

/** Connection URL. Redis is optional — the service degrades without it. */
export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Redis handle for cart-service; the connection is created on import. */
export const redis: RedisService = createRedisService({
  url: REDIS_URL,
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? "cart:v1:",
  serviceName: "cart-service",
  logger,
});
