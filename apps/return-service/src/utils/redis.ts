/**
 * Return-service Redis handle.
 *
 * Everything Redis-related for this service is declared here once, through
 * `@repo/redis`'s per-service facade: the connection, the `return:v1:` key
 * namespace, health check, and distributed cluster leader locking for the outbox sweeper.
 */
import { createRedisService } from "@repo/redis";
import type { RedisService } from "@repo/redis";
import { env } from "../config/env.js";

export const REDIS_URL = env.REDIS_URL ?? "redis://localhost:6379";

export const redis: RedisService = createRedisService({
  url: REDIS_URL,
  keyPrefix: "return:v1:",
  serviceName: "return-service",
  logger: console,
});
