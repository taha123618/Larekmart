import { createStateRedisService, type RedisService } from "@repo/redis";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("payment-service:redis");

export const redis: RedisService = createStateRedisService({
  url:
    process.env.REDIS_STATE_URL ??
    process.env.REDIS_URL ??
    "redis://localhost:6379",
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? "payment:v1:",
  serviceName: "payment-service",
  logger,
});
