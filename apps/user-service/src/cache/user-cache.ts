import { cacheRead, cacheSet, cacheDel } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { logger, userMetrics, health } from "../observability/metrics.js";
import { createDbCheck } from "@repo/monitoring";

export const redisService = redis;

health.register(
  "redis",
  createDbCheck("Redis", async () => {
    const pong = await redis.client.ping();
    if (pong !== "PONG") {
      throw new Error("Redis did not return PONG");
    }
  }),
  { critical: false },
);

export const UserCacheKeys = {
  userMe: (userId: string) => `user:me:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  userByAuth: (authUserId: string) => `user:auth:${authUserId}`,
  addresses: (userId: string) => `user:addresses:${userId}`,
  preferences: (userId: string) => `user:preferences:${userId}`,
  settings: (userId: string) => `user:settings:${userId}`,
};

const DEFAULT_TTL_SECONDS = 300; // 5 minutes (short, controlled TTL)

export async function getCached<T>(key: string, cacheType = "profile"): Promise<T | null> {
  const result = await cacheRead<T>(redis.client, key);
  if (result.status === "hit" && result.value) {
    userMetrics.cacheHits.inc({ cache_type: cacheType });
    return result.value;
  }
  userMetrics.cacheMisses.inc({ cache_type: cacheType });
  return null;
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await cacheSet(redis.client, key, data, ttlSeconds);
  } catch (err) {
    logger.warn("Failed to set user cache in Redis", { key, error: err });
  }
}

export async function invalidateUserCache(userId: string, authUserId?: string): Promise<void> {
  try {
    const keysToDelete = [
      UserCacheKeys.userMe(userId),
      UserCacheKeys.userProfile(userId),
      UserCacheKeys.addresses(userId),
      UserCacheKeys.preferences(userId),
      UserCacheKeys.settings(userId),
    ];
    if (authUserId) {
      keysToDelete.push(UserCacheKeys.userByAuth(authUserId));
    }
    await Promise.all(keysToDelete.map((key) => cacheDel(redis.client, key)));
    logger.debug(`Invalidated cache for user ${userId}`);
  } catch (err) {
    logger.warn("Failed to invalidate user cache", { userId, error: err });
  }
}
