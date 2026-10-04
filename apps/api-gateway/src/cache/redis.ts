import { redis } from "../utils/redis.js";

export function getRedisClient() {
  return redis.client;
}

export async function checkRedisHealth(): Promise<boolean> {
  return redis.ping();
}

export async function closeRedis(): Promise<void> {
  return redis.close();
}

export { redis };
