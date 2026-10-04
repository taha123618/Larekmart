import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { createRedisClient } from "@repo/redis";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { gatewayRateLimitHitsTotal } from "../observability/metrics.js";

export async function registerRateLimitMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  let redisClient: ReturnType<typeof createRedisClient> | undefined = undefined;

  try {
    redisClient = createRedisClient({
      url: env.REDIS_URL,
      serviceName: "api-gateway",
    });

    redisClient.on("error", (err) => {
      logger.warn("Gateway Redis rate-limiter connection warning", {
        error: String(err),
      });
    });
  } catch (err) {
    logger.warn("Could not initialize Redis for rate limiting, falling back to local memory", {
      error: String(err),
    });
  }

  await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: "1 minute",
    redis: redisClient as any,
    keyGenerator: (req) => {
      // Prioritize authenticated user ID, fall back to IP address
      const authHeader = req.headers.authorization;
      const userHeader = req.headers["x-user-id"];
      if (typeof userHeader === "string") {
        return `user:${userHeader}`;
      }
      if (typeof authHeader === "string") {
        return `token:${authHeader.slice(-16)}`;
      }
      return req.ip;
    },
    errorResponseBuilder: (req, context) => {
      gatewayRateLimitHitsTotal.inc({
        route: req.url,
      });

      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Maximum ${context.max} requests per ${context.after}. Please try again later.`,
        requestId: req.headers["x-request-id"],
      };
    },
  });
}
