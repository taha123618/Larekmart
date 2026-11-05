import type { Request, Response, NextFunction } from "express";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
} from "@repo/redis";
import { redis } from "../utils/redis.js";
import { logger } from "../observability/metrics.js";

/**
 * Middleware that enforces distributed idempotency on state-mutating requests
 * when the client provides an `Idempotency-Key` HTTP header.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = (req.headers["idempotency-key"] ||
    req.headers["Idempotency-Key"]) as string | undefined;

  if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
    return next();
  }

  // Gracefully bypass if Redis is not operational
  if (redis.client.status !== "ready" && redis.client.status !== "connect") {
    return next();
  }

  const identity = req.userId || req.guestToken || "anonymous";
  const idempotencyKey = redis.keys.simple(
    `idempotency:${identity}:${rawKey.trim()}`,
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
      res.status(409).json({
        message: "A mutation with this Idempotency-Key is currently in-flight",
      });
      return;
    }

    if (lockResult.status === "replayed") {
      res.setHeader("x-idempotent-replay", "true");
      res.status(lockResult.response.statusCode).json(lockResult.response.body);
      return;
    }

    if (lockResult.status === "error") {
      logger.warn(
        "Idempotency lock check encountered Redis error; proceeding non-idempotently",
        {
          idempotencyKey,
          error: lockResult.message,
        },
      );
      return next();
    }

    // Intercept response to commit or release idempotency lease
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let committed = false;

    const commitOrRelease = async (body: unknown) => {
      if (committed) return;
      committed = true;

      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let parsedBody = body;
          if (typeof body === "string") {
            try {
              parsedBody = JSON.parse(body);
            } catch {
              parsedBody = body;
            }
          }
          await commitIdempotencyResponse(redis.client, idempotencyKey, {
            statusCode: res.statusCode,
            body: parsedBody,
          });
        } else {
          await releaseIdempotencyLock(redis.client, idempotencyKey);
        }
      } catch (err) {
        logger.error(
          "Failed to commit/release idempotency lock",
          err as Error,
          {
            idempotencyKey,
          },
        );
      }
    };

    res.json = function (body: unknown): Response {
      void commitOrRelease(body);
      return originalJson(body);
    };

    res.send = function (body: unknown): Response {
      void commitOrRelease(body);
      return originalSend(body);
    };

    next();
  } catch (err) {
    logger.error("Unexpected error in idempotency middleware", err as Error, {
      idempotencyKey,
    });
    next();
  }
}
