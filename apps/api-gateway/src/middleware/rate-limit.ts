import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { getRedisClient } from "../cache/redis.js";
import { getRateLimitForRoute } from "../gateway/policies.js";
import { gatewayRateLimitHitsTotal } from "../observability/metrics.js";

export async function registerRateLimitMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  const redisClient = getRedisClient();

  await fastify.register(rateLimit, {
    max: (req) => {
      const policy = getRateLimitForRoute(req.url);
      return policy.limit;
    },
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
