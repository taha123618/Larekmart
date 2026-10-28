import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";

let redisInstance: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!redisInstance) {
    redisInstance = createRedisService({
      url: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
      serviceName: "pricing-service",
    });
  }
  return redisInstance;
}

export const redis = getRedisService();

