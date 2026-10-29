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
    const maxConcurrent = InFlightBulkhead.getMaxConcurrent(category, isDegraded);

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

