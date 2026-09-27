import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";

export const redis: RedisService = createRedisService({
  url: env.REDIS_URL,
  keyPrefix: env.REDIS_KEY_PREFIX,
  serviceName: "user-service",
  logger,
});
