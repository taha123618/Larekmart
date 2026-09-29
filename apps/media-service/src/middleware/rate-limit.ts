import type { MiddlewareHandler } from "hono";
import { checkRateLimit } from "@repo/redis";
import type { Context } from "hono";
import { redis } from "../utils/redis.js";
import { logger } from "../observability/metrics.js";

export interface RateLimitRule {
  /** Bucket name, combined with identity into the Redis key. */
  name: string;
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Redis-backed fixed-window rate limiter (spec section 46). Identity is the
 * verified Clerk userId; unauthenticated callers fall back to client IP.
 *
 * Fails OPEN when Redis is unreachable: availability beats enforcement for
 * these limits, and Redis is never a correctness dependency.
 */
export function createRateLimiter(rule: RateLimitRule): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    const identity =
      c.get("userId") ?? c.req.header("x-forwarded-for") ?? "anonymous";
    const key = redis.keys.namespace("ratelimit", rule.name, identity);

    try {
      const result = await checkRateLimit(redis.client, {
        key,
        maxRequests: rule.maxRequests,
        windowSeconds: rule.windowSeconds,
      });

      c.res.headers.set("X-RateLimit-Limit", String(rule.maxRequests));
      c.res.headers.set("X-RateLimit-Remaining", String(result.remaining));
      c.res.headers.set("X-RateLimit-Reset", String(result.resetIn));

      if (!result.allowed) {
        return c.json(
          {
            message: "Rate limit exceeded",
            retryAfterSeconds: result.resetIn,
          },
          429,
        );
      }
    } catch (error) {
      logger.warn(
        `Rate limiter unavailable (${rule.name}); failing open: ${String(error)}`,
      );
    }

    await next();
  };
}

/** Configurable default rules for media endpoints. */
export const mediaRateLimitRules = {
  uploadCreate: {
    name: "upload-create",
    maxRequests: Number.parseInt(
      process.env.MEDIA_RATE_LIMIT_UPLOAD_CREATE ?? "30",
      10,
    ),
    windowSeconds: 60,
  },
  uploadComplete: {
    name: "upload-complete",
    maxRequests: Number.parseInt(
      process.env.MEDIA_RATE_LIMIT_UPLOAD_COMPLETE ?? "60",
      10,
    ),
    windowSeconds: 60,
  },
  urlGeneration: {
    name: "url-generation",
    maxRequests: Number.parseInt(process.env.MEDIA_RATE_LIMIT_URL ?? "300", 10),
    windowSeconds: 60,
  },
  deleteMedia: {
    name: "delete-media",
    maxRequests: Number.parseInt(
      process.env.MEDIA_RATE_LIMIT_DELETE ?? "30",
      10,
    ),
    windowSeconds: 60,
  },
  admin: {
    name: "admin",
    maxRequests: Number.parseInt(
      process.env.MEDIA_RATE_LIMIT_ADMIN ?? "120",
      10,
    ),
    windowSeconds: 60,
  },
} as const;
