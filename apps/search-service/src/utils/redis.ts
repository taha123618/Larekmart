/**
 * Search-service Redis handle.
 *
 * Everything Redis-related for this service is declared here once, through
 * `@repo/redis`'s per-service facade. The handle owns the connection, the
 * `search:v1:` key namespace, the health probe, and shutdown.
 *
 * Consumers import `redis` from here rather than reaching for `@repo/redis`
 * directly, because this handle is bound to the service's URL and prefix:
 *
 * - `redis.client` — pass to the package's cache/rate-limit helpers
 * - `redis.keys`   — compose keys (`redis.keys.namespace(...)`)
 * - `redis.ping()` — readiness checks
 * - `redis.close()` — graceful shutdown
 */
import { createRedisService } from "@repo/redis";
import type { RedisService } from "@repo/redis";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

/** Redis handle for search-service; the connection is created on import. */
export const redis: RedisService = createRedisService({
  url: config.redis.url,
  keyPrefix: config.redis.keyPrefix,
  serviceName: "search-service",
  logger,
});
