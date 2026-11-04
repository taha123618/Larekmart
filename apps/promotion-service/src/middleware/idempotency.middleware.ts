import { createMiddleware } from "hono/factory";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
} from "@repo/redis";
import { redis } from "../utils/redis.js";
import { logger } from "../observability/metrics.js";

/**
 * Hono middleware enforcing distributed idempotency on state-mutating routes
 * when an `Idempotency-Key` header is supplied.
 */
export const idempotencyMiddleware = createMiddleware(async (c, next) => {
  const rawKey =
    c.req.header("idempotency-key") || c.req.header("Idempotency-Key");
  if (!rawKey || !rawKey.trim()) {
    return next();
  }

  // Gracefully pass through if Redis is disconnected
  if (redis.client.status !== "ready" && redis.client.status !== "connect") {
    return next();
  }

  const userId =
    (c.get as any)("userId") || (c.get as any)("guestId") || "anonymous";
  const idempotencyKey = redis.keys.simple(
    `idempotency:${userId}:${rawKey.trim()}`,
  );

  try {
    const lockResult = await acquireIdempotencyLock(
      redis.client,
      idempotencyKey,
      {
        lockTtlMs: 10000,
        retentionTtlSec: 86400,
      },
    );

    if (lockResult.status === "conflict") {
      return c.json(
        {
          message:
            "A mutation with this Idempotency-Key is currently in-flight",
        },
        409,
      );
    }

    if (lockResult.status === "replayed") {
      c.header("x-idempotent-replay", "true");
      return c.json(
        lockResult.response.body,
        lockResult.response.statusCode as any,
      );
    }

    if (lockResult.status === "error") {
      logger.warn(
        "Idempotency lock check encountered Redis error; proceeding",
        {
          idempotencyKey,
          error: lockResult.message,
        },
      );
      return next();
    }

    // Proceed with handler execution
    await next();

    // After handler execution, inspect response status
    const status = c.res.status;
    if (status >= 200 && status < 300) {
      try {
        const clonedRes = c.res.clone();
        const body = await clonedRes.json().catch(() => null);
        if (body) {
          await commitIdempotencyResponse(redis.client, idempotencyKey, {
            statusCode: status,
            body,
          });
        }
      } catch (err) {
        logger.error(
          "Failed to commit idempotency response",
          err as Error,
          { idempotencyKey },
        );
      }
    } else {
      await releaseIdempotencyLock(redis.client, idempotencyKey).catch(
        () => {},
      );
    }
  } catch (err) {
    logger.error(
      "Unexpected error in promotion idempotency middleware",
      err as Error,
      { idempotencyKey },
    );
    return next();
  }
});

