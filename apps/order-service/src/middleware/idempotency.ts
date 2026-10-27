import type { FastifyRequest, FastifyReply } from "fastify";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
  type IdempotentResponse,
} from "@repo/redis";
import { redis } from "../utils/redis.js";
import { logger } from "../observability/metrics.js";

export interface IdempotencyHandlerOptions {
  /** Prefix for the Redis key, e.g. 'order:cod:' (default: 'order:idemp:') */
  prefix?: string;
  /** Lock TTL in ms while processing mutation (default: 60,000ms) */
  lockTtlMs?: number;
  /** Retention TTL in sec for completed result (default: 86,400s / 24 hours) */
  retentionTtlSec?: number;
}

/**
 * Executes a mutation handler within a distributed idempotency envelope.
 *
 * 1. Inspects request header `idempotency-key` (or `Idempotency-Key`).
 * 2. If absent, executes normally without caching.
 * 3. If present:
 *    - Acquires atomic Redis lock (`SET NX PX`).
 *    - If already completed: replays cached response with `Idempotent-Replayed: true`.
 *    - If currently in-flight: returns 409 Conflict.
 *    - If acquired: executes `handler()`.
 *      - On success: commits response to Redis and sends it.
 *      - On failure: releases lock in Redis and re-throws error so client can retry.
 */
export async function executeWithIdempotency<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<{ statusCode: number; data: T }>,
  options: IdempotencyHandlerOptions = {},
): Promise<FastifyReply> {
  const rawKey =
    (request.headers["idempotency-key"] as string | undefined) ||
    (request.headers["Idempotency-Key"] as string | undefined);

  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
    // No idempotency key provided; pass through
    const result = await handler();
    return reply.status(result.statusCode).send(result.data);
  }

  const prefix = options.prefix ?? "idemp:";
  const redisKey = redis.keys.simple(`${prefix}${rawKey.trim()}`);

  const lockResult = await acquireIdempotencyLock(redis.client, redisKey, {
    lockTtlMs: options.lockTtlMs ?? 60000,
    retentionTtlSec: options.retentionTtlSec ?? 86400,
  });

  if (lockResult.status === "replayed") {
    logger.info("Replaying cached idempotent response", {
      key: rawKey,
      statusCode: lockResult.response.statusCode,
    });
    return reply
      .header("Idempotent-Replayed", "true")
      .status(lockResult.response.statusCode)
      .send(lockResult.response.body);
  }

  if (lockResult.status === "conflict") {
    logger.warn("Idempotency conflict: mutation currently in-flight", {
      key: rawKey,
    });
    return reply.status(409).send({
      message: "A mutation with this Idempotency-Key is currently in-flight",
      statusCode: 409,
      idempotencyKey: rawKey,
    });
  }

  // Lock acquired: execute mutation handler
  try {
    const result = await handler();

    // Commit completed response to Redis
    const responsePayload: IdempotentResponse = {
      statusCode: result.statusCode,
      body: result.data,
    };

    await commitIdempotencyResponse(redis.client, redisKey, responsePayload, {
      retentionTtlSec: options.retentionTtlSec ?? 86400,
    });

    return reply.status(result.statusCode).send(result.data);
  } catch (error: unknown) {
    // Release lock so client can legitimately retry the failed mutation
    await releaseIdempotencyLock(redis.client, redisKey);
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as any).statusCode === "number"
    ) {
      return reply
        .status((error as any).statusCode)
        .send({ message: (error as any).message });
    }
    throw error;
  }
}
