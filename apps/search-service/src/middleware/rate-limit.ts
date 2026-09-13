import type { FastifyRequest, FastifyReply } from "fastify";
import { checkRateLimit } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

/**
 * Creates a Fastify preHandler hook that enforces a fixed-window rate limit
 * per IP address × route using Redis (`@repo/redis`'s `checkRateLimit`).
 *
 * If Redis is unreachable the hook **fails open** — the request is allowed
 * through with a debug log, so a Redis outage never causes downtime.
 *
 * Rate-limit headers set on every response:
 *  - `X-RateLimit-Limit`
 *  - `X-RateLimit-Remaining`
 *  - `Retry-After` (on 429 only)
 */
export function createRateLimiter(options?: {
  windowSeconds?: number;
  maxRequests?: number;
}) {
  const windowSeconds =
    options?.windowSeconds ?? config.redis.rateLimitWindowSeconds;
  const maxRequests = options?.maxRequests ?? config.redis.rateLimitMaxRequests;

  return async function rateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ip = request.ip || "127.0.0.1";
    const routeKey = request.routeOptions.url ?? request.url;
    const key = redis.keys.namespace("ratelimit", routeKey, ip);

    try {
      const result = await checkRateLimit(redis.client, {
        key,
        maxRequests,
        windowSeconds,
      });

      reply.header("X-RateLimit-Limit", result.limit);
      reply.header("X-RateLimit-Remaining", result.remaining);

      if (!result.allowed) {
        reply.header("Retry-After", result.resetIn);
        return reply.status(429).send({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
      }
    } catch (error) {
      // Fail open: if Redis is down, allow the request through.
      logger.debug("Rate limiter Redis bypass — Redis unreachable", { error });
    }
  };
}
