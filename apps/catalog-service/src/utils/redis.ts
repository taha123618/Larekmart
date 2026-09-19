import { createRedisService } from "@repo/redis";
import type { RedisService } from "@repo/redis";
import { logger } from "../observability/metrics.js";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis: RedisService = createRedisService({
  url: REDIS_URL,
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? "catalog:v1:",
  serviceName: "catalog-service",
  logger,
});
