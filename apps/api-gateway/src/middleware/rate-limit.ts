import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { redis } from "../utils/redis.js";
import { getAdaptiveRateLimitForRoute } from "../gateway/policies.js";
import {
  gatewayRateLimitHitsTotal,
  gatewayBulkheadShedHitsTotal,
} from "../observability/metrics.js";
import { circuitBreaker } from "../resilience/circuit-breaker.js";
import {
  InFlightBulkhead,
  inFlightBulkhead,
} from "../resilience/in-flight-bulkhead.js";

const SAGA_DOWNSTREAM_SERVICES = [
  "order-service",
  "tax-service",
  "inventory-service",
  "payment-service",
];

export function isDownstreamDegraded(
  services = SAGA_DOWNSTREAM_SERVICES,
  cb = circuitBreaker,
): boolean {
  return services.some((svc) => {
    const state = cb.getState(svc);
    return state === "OPEN" || state === "HALF_OPEN";
  });
}

export async function registerRateLimitMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  // 1. In-flight Concurrency Bulkhead Guardrail
  fastify.addHook("onRequest", async (req, reply) => {
    const category = InFlightBulkhead.getCategoryForRoute(req.url);
    if (!category) return;

    const isDegraded = isDownstreamDegraded();
    const maxConcurrent = InFlightBulkhead.getMaxConcurrent(
      category,
      isDegraded,
    );

    if (!inFlightBulkhead.acquire(category, maxConcurrent)) {
      gatewayBulkheadShedHitsTotal.inc({ category });
      reply.header("Retry-After", "15");
      return reply.status(503).send({
        statusCode: 503,
        error: "Service Unavailable",
        message:
          "Concurrent transactional capacity saturated under downstream degradation. Shedding load to protect cluster.",
        requestId: req.headers["x-request-id"],
        retryAfter: 15,
      });
    }
  });

  fastify.addHook("onResponse", async (req) => {
    const category = InFlightBulkhead.getCategoryForRoute(req.url);
    if (category) {
      inFlightBulkhead.release(category);
    }
  });

  fastify.addHook("onError", async (req) => {
    const category = InFlightBulkhead.getCategoryForRoute(req.url);
    if (category) {
      inFlightBulkhead.release(category);
    }
  });

  // 2. Distributed Adaptive Rate Limiter
  await fastify.register(rateLimit, {
    max: (req) => {
      const isDegraded = isDownstreamDegraded();
      const policy = getAdaptiveRateLimitForRoute(req.url, isDegraded);
      return policy.limit;
    },
    timeWindow: "1 minute",
    redis: redis.client as any,
    keyGenerator: (req) => {
      // Never trust client-supplied identity headers here: x-user-id is stripped
      // by the proxy later, but the rate limiter runs first and an attacker
      // could rotate it to bypass limits. Prefer the verified auth identity,
      // then a stable hash of the bearer token, then the trusted proxy IP.
      const authUserId = (req as { authUserId?: string }).authUserId;
      if (authUserId) {
        return `user:${authUserId}`;
      }
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.length > 0) {
        const tokenHash = createHash("sha256")
          .update(authHeader)
          .digest("hex")
          .slice(0, 32);
        return `token:${tokenHash}`;
      }
      return `ip:${req.ip}`;
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
