import { FastifyRequest, FastifyReply } from "fastify";
import Redis from "ioredis";
import { env } from "../config/env.js";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redisClient.connect().catch((err) => {
      console.warn("[ChatService:Redis] Failed to connect to Redis:", err.message);
    });
  }
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}

/**
 * Fastify preHandler hook for distributed Idempotency-Key handling.
 */
export async function idempotencyHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const idempotencyKey = request.headers["idempotency-key"] as
    | string
    | undefined;

  if (!idempotencyKey) {
    return;
  }

  const userId = request.user?.userId || "anon";
  const redis = getRedisClient();
  const lockKey = `chat:idempotency:${userId}:${idempotencyKey}`;

  try {
    const cachedResponse = await redis.get(`${lockKey}:response`);
    if (cachedResponse) {
      const parsed = JSON.parse(cachedResponse);
      reply
        .header("X-Cache-Lookup", "HIT")
        .header("Idempotent-Replayed", "true")
        .status(parsed.statusCode || 200)
        .send(parsed.data);
      return;
    }

    // Acquire atomic lease lock for 10 seconds
    const acquired = await redis.set(lockKey, "LOCKED", "PX", 10000, "NX");
    if (!acquired) {
      reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "A mutation with this Idempotency-Key is currently in-flight",
      });
      return;
    }

    // Capture response to cache on 2xx
    const originalSend = reply.send.bind(reply);
    reply.send = function (payload: unknown) {
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        let serialized = "";
        try {
          serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
          redis
            .set(
              `${lockKey}:response`,
              JSON.stringify({ statusCode: reply.statusCode, data: JSON.parse(serialized) }),
              "EX",
              86400, // 24 hours retention
            )
            .catch(() => {});
        } catch {}
      }
      redis.del(lockKey).catch(() => {});
      return originalSend(payload);
    };
  } catch (err) {
    // If Redis is unreachable, fail-open to process request safely
    console.warn("[ChatService:Idempotency] Redis error, bypassing lease:", err);
  }
}
