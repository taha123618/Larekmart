import { createRedisClient, type Redis } from "@repo/redis";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";

let redisClientInstance: Redis | null = null;
let isRedisConnecting = false;

export function getRedisClient(): Redis | null {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  if (isRedisConnecting) {
    return null;
  }

  try {
    isRedisConnecting = true;
    redisClientInstance = createRedisClient({
      url: env.REDIS_URL,
      serviceName: "api-gateway",
    });

    redisClientInstance.on("error", (err: unknown) => {
      logger.warn("Gateway Redis client error", {
        error: String(err),
      });
    });

    redisClientInstance.on("connect", () => {
      logger.info("Gateway Redis client connected successfully");
    });

    return redisClientInstance;
  } catch (err) {
    logger.warn("Gateway Redis client initialization failed, continuing without distributed cache", {
      error: String(err),
    });
    return null;
  } finally {
    isRedisConnecting = false;
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }

  try {
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClientInstance) {
    try {
      await redisClientInstance.quit();
      redisClientInstance = null;
    } catch {
      // Ignore disconnect errors during shutdown
    }
  }
}
