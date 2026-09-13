import { Redis } from "ioredis";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = config.redis.url;
    logger.info(`Initializing Redis client for URL: ${url}`);

    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn("Redis retry attempts exceeded limit; backing off");
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: false,
    });

    redisClient.on("connect", () => {
      isConnected = true;
      logger.info("Connected to Redis");
    });

    redisClient.on("ready", () => {
      isConnected = true;
      logger.info("Redis client ready");
    });

    redisClient.on("error", (err) => {
      isConnected = false;
      logger.warn("Redis error (operating in bypass mode if down)", { error: err.message });
    });

    redisClient.on("close", () => {
      isConnected = false;
      logger.warn("Redis connection closed");
    });
  }

  return redisClient;
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch (err) {
    logger.warn("Redis ping failed", { error: err });
    return false;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("Redis client disconnected");
    } catch (error) {
      logger.error("Error disconnecting Redis client", { error });
    } finally {
      redisClient = null;
      isConnected = false;
    }
  }
}
