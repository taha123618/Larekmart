/**
 * Search-service Redis client adapter.
 *
 * This module wires the @repo/redis factory to the search-service configuration
 * and re-exports the helpers that the rest of the service expects so that
 * internal imports (`"../utils/redis.js"`) continue to resolve without changes.
 *
 * Consumers of the search-service should import from here, not from @repo/redis
 * directly, because the singleton is bound to the service's Redis URL.
 */
import {
  createRedisClient,
  closeRedisClient as _close,
  checkRedisConnection as _check,
} from "@repo/redis";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

/** Re-export the Redis type for callers that need to annotate variables. */
export type { Redis };

/**
 * Returns the process-wide singleton ioredis client configured for this
 * service.  Creates it on first call.
 */
export function getRedisClient(): Redis {
  return createRedisClient(
    {
      url: config.redis.url,
      keyPrefix: config.redis.keyPrefix,
      maxRetries: 5,
      maxRetryDelayMs: 2000,
      serviceName: "search-service",
    },
    logger,
  );
}

/**
 * Sends a PING to Redis.  Returns `true` if the server responds with PONG.
 * Never throws.
 */
export async function checkRedisConnection(): Promise<boolean> {
  return _check(getRedisClient());
}

/**
 * Gracefully quits the Redis connection.  Called during server shutdown.
 */
export async function closeRedisClient(): Promise<void> {
  return _close(config.redis.url, logger);
}
