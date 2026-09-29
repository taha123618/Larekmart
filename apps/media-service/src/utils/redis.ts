import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";

/**
 * Redis handle — cache / rate limiting / upload-session state / processing
 * locks only. Redis is NEVER the source of truth for media metadata or
 * binaries (spec section 19); a Redis outage degrades performance but never
 * correctness.
 */
export const redis: RedisService = createRedisService({
  url: env.REDIS_URL,
  keyPrefix: env.REDIS_KEY_PREFIX,
  serviceName: "media-service",
  logger: {
    info: (message: string) => logger.info(message),
    warn: (message: string) => logger.warn(message),
    error: (message: string, error?: unknown) =>
      logger.error(message, error ?? ""),
  },
});

/** Metadata cache TTL (seconds). */
export const mediaCacheTtlSeconds = env.MEDIA_CACHE_TTL_SECONDS;
