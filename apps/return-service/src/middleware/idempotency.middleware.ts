import type { Context, Next, Middleware } from "koa";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
  type IdempotentResponse,
} from "@repo/redis";
import { redis } from "../utils/redis.js";

export interface IdempotencyMiddlewareOptions {
  prefix?: string;
  lockTtlMs?: number;
  retentionTtlSec?: number;
}

/**
 * Koa 2 middleware that enforces distributed idempotency on state-mutating requests
 * when the client provides an `Idempotency-Key` HTTP header.
 *
 * Guarantees:
 * 1. Mutual exclusion during in-flight execution via atomic Redis SET NX PX.
 * 2. Transparent replay of cached responses on duplicate requests.
 * 3. HTTP 409 Conflict rejection if an identical mutation is actively in-flight.
 * 4. Automatic release of the lock if the downstream handler fails or throws.
 */
export function idempotencyMiddleware(
  options: IdempotencyMiddlewareOptions = {},
): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    const rawKey =
      (ctx.headers["idempotency-key"] as string | undefined) ||
      (ctx.headers["Idempotency-Key"] as string | undefined);

    if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
      await next();
      return;
    }

    // Gracefully bypass if Redis is not operational
    if (redis.client.status !== "ready" && redis.client.status !== "connect") {
      await next();
      return;
    }

    const identity = (ctx.state.userId as string) || "anonymous";
    const prefix = options.prefix ?? "return:idemp:";
    const idempotencyKey = redis.keys.simple(
      `${prefix}${identity}:${rawKey.trim()}`,
    );

    const lockResult = await acquireIdempotencyLock(
      redis.client,
      idempotencyKey,
      {
        lockTtlMs: options.lockTtlMs ?? 10000,
        retentionTtlSec: options.retentionTtlSec ?? 86400,
      },
    );

    if (lockResult.status === "replayed") {
      ctx.set("Idempotent-Replayed", "true");
      ctx.set("x-idempotent-replay", "true");
      ctx.status = lockResult.response.statusCode;
      ctx.body = lockResult.response.body;
      return;
    }

    if (lockResult.status === "conflict") {
      ctx.status = 409;
      ctx.body = {
        message: "A mutation with this Idempotency-Key is currently in-flight",
        statusCode: 409,
        idempotencyKey: rawKey,
      };
      return;
    }

    if (lockResult.status === "error") {
      // If Redis errored on lock acquisition, proceed without breaking client
      await next();
      return;
    }

    try {
      await next();

      if (ctx.status >= 200 && ctx.status < 300) {
        const responsePayload: IdempotentResponse = {
          statusCode: ctx.status,
          body: ctx.body,
        };

        await commitIdempotencyResponse(
          redis.client,
          idempotencyKey,
          responsePayload,
          {
            retentionTtlSec: options.retentionTtlSec ?? 86400,
          },
        );
      } else {
        await releaseIdempotencyLock(redis.client, idempotencyKey);
      }
    } catch (error) {
      await releaseIdempotencyLock(redis.client, idempotencyKey);
      throw error;
    }
  };
}
