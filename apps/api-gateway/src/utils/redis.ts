/**
 * API Gateway Redis handle.
 *
 * Everything Redis-related for this service is declared here once, through
 * `@repo/redis`'s per-service facade: the connection, the `gateway:v1:` key
 * namespace, the health probe, and shutdown.
 *
 * - `redis.client` — pass to the package's cache helpers or rate limiters
 * - `redis.keys`   — compose keys (`redis.keys.simple(...)`)
 * - `redis.ping()` — health checks
 * - `redis.close()` — shutdown
 */
import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";

/** Connection URL. Redis is optional — the service degrades gracefully without it. */
export const REDIS_URL = env.REDIS_URL ?? "redis://localhost:6379";

/** Redis handle for api-gateway; the connection is created on import. */
export const redis: RedisService = createRedisService({
  url: REDIS_URL,
  keyPrefix: env.REDIS_KEY_PREFIX ?? "gateway:v1:",
  serviceName: "api-gateway",
  logger,
});
