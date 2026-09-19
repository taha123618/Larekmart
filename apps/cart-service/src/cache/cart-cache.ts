import { cacheRead, cacheSet, cacheDel } from "@repo/redis";
import { logger, cacheMetrics } from "../observability/metrics.js";
import { env } from "../config/env.js";
import type { CartResponseType } from "@repo/types";
import { redis } from "../utils/redis.js";

export { redis };

const EXPIRATION_ZSET_KEY = "cart:expirations:zset";

export const getCartCacheKey = (identifier: {
  userId?: string | null;
  guestToken?: string | null;
}): string => {
  if (identifier.userId) {
    return redis.keys.simple(`user:${identifier.userId}`);
  }
  if (identifier.guestToken) {
    return redis.keys.simple(`guest:${identifier.guestToken}`);
  }
  throw new Error(
    "Either userId or guestToken must be provided for cart cache key",
  );
};

export const getCachedCart = async (
  key: string,
): Promise<CartResponseType | null> => {
  const result = await cacheRead<CartResponseType>(redis.client, key);
  if (result.status === "hit" && result.value) {
    cacheMetrics.hits.inc({ cache_type: "cart" });
    return result.value;
  }
  if (result.status === "miss") {
    cacheMetrics.misses.inc({ cache_type: "cart" });
    return null;
  }
  if (result.status === "error") {
    cacheMetrics.errors.inc({ cache_type: "cart" });
    return null;
  }
  return null;
};

export const setCachedCart = async (
  key: string,
  cart: CartResponseType,
  ttlSeconds: number = env.CART_CACHE_TTL_SECONDS,
): Promise<void> => {
  try {
    await cacheSet(redis.client, key, cart, ttlSeconds);
  } catch (err) {
    logger.warn("Failed to set cart cache in Redis", {
      key,
      error: String(err),
    });
  }
};

export const invalidateCartCache = async (identifier: {
  userId?: string | null;
  guestToken?: string | null;
}): Promise<void> => {
  try {
    const keysToDelete: string[] = [];
    if (identifier.userId) {
      keysToDelete.push(redis.keys.simple(`user:${identifier.userId}`));
    }
    if (identifier.guestToken) {
      keysToDelete.push(redis.keys.simple(`guest:${identifier.guestToken}`));
    }
    for (const key of keysToDelete) {
      await cacheDel(redis.client, key);
    }
  } catch (err) {
    logger.warn("Failed to invalidate cart cache in Redis", {
      userId: identifier.userId ?? undefined,
      guestToken: identifier.guestToken ?? undefined,
      error: String(err),
    });
  }
};

/**
 * Schedules a cart for expiration tracking in a Redis sorted set
 */
export const scheduleCartExpiration = async (
  cartId: string,
  expiresAt: Date,
): Promise<void> => {
  try {
    const score = expiresAt.getTime();
    await redis.client.zadd(
      redis.keys.simple(EXPIRATION_ZSET_KEY),
      score,
      cartId,
    );
  } catch (err) {
    logger.warn("Failed to schedule cart expiration in Redis", {
      cartId,
      error: String(err),
    });
  }
};

/**
 * Retrieves and removes cart IDs that have expired up to current timestamp
 */
export const popExpiredCartIds = async (
  maxCount: number = 50,
): Promise<string[]> => {
  try {
    const now = Date.now();
    const key = redis.keys.simple(EXPIRATION_ZSET_KEY);
    // Find expired members with score <= now
    const expiredIds = await redis.client.zrangebyscore(
      key,
      0,
      now,
      "LIMIT",
      0,
      maxCount,
    );
    if (expiredIds.length > 0) {
      await redis.client.zrem(key, ...expiredIds);
    }
    return expiredIds;
  } catch (err) {
    logger.warn("Failed to pop expired carts from Redis sorted set", {
      error: String(err),
    });
    return [];
  }
};
