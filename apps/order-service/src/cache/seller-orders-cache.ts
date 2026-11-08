/**
 * Read-through cache and SingleFlight request coalescing for seller orders.
 *
 * In sharded MongoDB clusters partitioned on `{ userId: "hashed" }`, queries without
 * a `userId` (such as `GET /seller-orders` and `GET /orders?sellerId=...`) must
 * broadcast across all shard nodes (scatter-gather).
 *
 * This module shields the MongoDB cluster from thundering herd and scatter-gather stampedes:
 * 1. Read-through caching with a bounded 15-second TTL in Redis.
 * 2. In-flight promise coalescing (SingleFlight) so concurrent requests from the same
 *    seller share a single database execution.
 * 3. Graceful degradation: If Redis is offline or unavailable, requests execute
 *    safely directly against MongoDB.
 */
import { cacheRead, cacheSet } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { cacheMetrics } from "../observability/metrics.js";

interface InflightCall<T> {
  promise: Promise<T>;
  waiters: number;
}

export class SingleFlightGroup {
  private calls = new Map<string, InflightCall<unknown>>();

  public async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.calls.get(key) as InflightCall<T> | undefined;
    if (existing) {
      existing.waiters++;
      return existing.promise;
    }

    const promise = fn().finally(() => {
      this.calls.delete(key);
    });

    this.calls.set(key, { promise, waiters: 0 });
    return promise;
  }
}

export const sellerOrdersSingleFlight = new SingleFlightGroup();

const SELLER_ORDERS_CACHE_PREFIX = "seller-orders";
const SELLER_ORDERS_TTL_SECONDS = 15;

/** Returns the cached seller orders array, or null on cache miss or Redis error. */
export async function getCachedSellerOrders<T>(
  sellerId: string,
  limit: number,
): Promise<T | null> {
  const cacheKey = redis.keys.simple(
    `${SELLER_ORDERS_CACHE_PREFIX}:${sellerId}:${limit}`,
  );
  return cacheMetrics.record(
    await cacheRead<T>(redis.client, cacheKey),
    SELLER_ORDERS_CACHE_PREFIX,
  );
}

/** Caches the seller orders array in Redis for the configured TTL. */
export async function setCachedSellerOrders<T>(
  sellerId: string,
  limit: number,
  orders: T,
): Promise<void> {
  const cacheKey = redis.keys.simple(
    `${SELLER_ORDERS_CACHE_PREFIX}:${sellerId}:${limit}`,
  );
  await cacheSet(redis.client, cacheKey, orders, SELLER_ORDERS_TTL_SECONDS);
}

/**
 * Executes seller orders query with in-flight SingleFlight coalescing and
 * read-through Redis caching.
 */
export async function fetchSellerOrdersCoalesced<T>(
  sellerId: string,
  limit: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const flightKey = `${sellerId}:${limit}`;
  return sellerOrdersSingleFlight.do(flightKey, async () => {
    // 1. Try cache read
    const cached = await getCachedSellerOrders<T>(sellerId, limit);
    if (cached) {
      return cached;
    }

    // 2. Execute authoritative database query
    const fresh = await fetchFn();

    // 3. Populate cache
    await setCachedSellerOrders(sellerId, limit, fresh).catch(() => {});

    return fresh;
  });
}
