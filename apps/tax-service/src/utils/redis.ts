import { createRedisService, type RedisService } from "@repo/redis";
import { env } from "../config/env.js";

export const redis: RedisService = createRedisService({
  url: env.REDIS_URL,
  keyPrefix: "tax:v1:",
  serviceName: "tax-service",
});
