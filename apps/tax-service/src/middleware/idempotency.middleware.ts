import type { FastifyRequest, FastifyReply } from "fastify";
import {
  acquireIdempotencyLock,
  commitIdempotencyResponse,
  releaseIdempotencyLock,
  type IdempotentResponse,
} from "@repo/redis";
import { redis } from "../utils/redis.js";

export interface IdempotencyHandlerOptions {
  prefix?: string;
  lockTtlMs?: number;
  retentionTtlSec?: number;
}

/**
 * Executes a state-mutating Fastify handler within an atomic distributed idempotency envelope.
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
    const result = await handler();
    return reply.status(result.statusCode).send(result.data);
  }

  // Gracefully pass through if Redis is disconnected
  if (redis.client.status !== "ready" && redis.client.status !== "connect") {
    const result = await handler();
    return reply.status(result.statusCode).send(result.data);
  }

  const prefix = options.prefix ?? "tax:idemp:";
  const redisKey = redis.keys.simple(`${prefix}${rawKey.trim()}`);

  const lockResult = await acquireIdempotencyLock(redis.client, redisKey, {
    lockTtlMs: options.lockTtlMs ?? 10000,
    retentionTtlSec: options.retentionTtlSec ?? 86400,
  });

  if (lockResult.status === "replayed") {
    return reply
      .header("Idempotent-Replayed", "true")
      .header("x-idempotent-replay", "true")
      .status(lockResult.response.statusCode)
      .send(lockResult.response.body);
  }

  if (lockResult.status === "conflict") {
    return reply.status(409).send({
      message: "A mutation with this Idempotency-Key is currently in-flight",
      statusCode: 409,
      idempotencyKey: rawKey,
    });
  }

  try {
    const result = await handler();

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const responsePayload: IdempotentResponse = {
        statusCode: result.statusCode,
        body: result.data,
      };

      await commitIdempotencyResponse(redis.client, redisKey, responsePayload, {
        retentionTtlSec: options.retentionTtlSec ?? 86400,
      });
    } else {
      await releaseIdempotencyLock(redis.client, redisKey);
    }

    return reply.status(result.statusCode).send(result.data);
  } catch (error: unknown) {
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
    const message =
      error instanceof Error ? error.message : "Internal processing error";
    return reply.status(400).send({ message });
  }
}

