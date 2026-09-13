import { createRedisService, type RedisService } from "@repo/redis";
import { logger } from "../observability/metrics.js";

export const redis: RedisService = createRedisService({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? "inventory:v1:",
  serviceName: "inventory-service",
  logger,
});

export const inventoryCacheTtlSeconds = Number.parseInt(
  process.env.INVENTORY_CACHE_TTL_SECONDS ?? "30",
  10,
);

export const namespaceFallback = { value: 0 };
