import type { FastifyRequest, FastifyReply } from "fastify";
import { getRedisClient } from "../cache/redis.js";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

export function createRateLimiter(options?: {
  windowSeconds?: number;
  maxRequests?: number;
}) {
  const window = options?.windowSeconds || config.redis.rateLimitWindowSeconds;
  const max = options?.maxRequests || config.redis.rateLimitMaxRequests;

  return async function rateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ip = request.ip || "127.0.0.1";
    const key = `${config.redis.keyPrefix}ratelimit:${request.routeOptions.url || request.url}:${ip}`;

    try {
      const redis = getRedisClient();
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, window);
      }

      reply.header("X-RateLimit-Limit", max);
      reply.header("X-RateLimit-Remaining", Math.max(0, max - current));

      if (current > max) {
        reply.header("Retry-After", window);
        return reply.status(429).send({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
      }
    } catch (error) {
      // If Redis is unreachable, fail open so legitimate traffic is not blocked
      logger.debug("Rate limiter Redis bypass", { error });
    }
  };
}
