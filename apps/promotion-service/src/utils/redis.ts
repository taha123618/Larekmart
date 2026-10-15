import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";

export const redis: RedisService = createRedisService({
  url: env.REDIS_URL,
  keyPrefix: env.REDIS_KEY_PREFIX,
  serviceName: "promotion-service",
});
