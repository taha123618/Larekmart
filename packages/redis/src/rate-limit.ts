import type { Redis } from "ioredis";
import type { RateLimitOptions, RateLimitResult } from "./types.js";

/**
 * Implements an atomic sliding-window rate limiter backed by Redis.
 *
 * Algorithm (INCR + EXPIRE):
 * 1. Increment the key (creating it if absent).
 * 2. On the first request (count === 1) set TTL to `windowSeconds`.
 * 3. Return the current count, remaining capacity, and whether the request
 *    is within the limit.
 *
 * The TTL is set only once per window (on first INCR) so the window is
 * fixed, not rolling. This is intentional — it keeps the implementation
 * O(1) per request and matches how most API rate limiters are deployed.
 *
 * @param client   - An ioredis client instance.
 * @param options  - Key, limit, and window configuration.
 * @returns        - Rate-limit decision with headers values ready to use.
 */
export async function checkRateLimit(
  client: Redis,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, maxRequests, windowSeconds } = options;

  const current = await client.incr(key);

  if (current === 1) {
    // New window — set expiry.  We don't await; a missed TTL is not fatal and
    // the worst case is an orphaned key that expires on its own next window.
    client.expire(key, windowSeconds).catch(() => {
      /* non-critical */
    });
  }

  // Best-effort TTL for the "resetIn" value.  Falls back to windowSeconds on error.
  let resetIn = windowSeconds;
  try {
    const ttl = await client.ttl(key);
    if (ttl > 0) resetIn = ttl;
  } catch {
    /* fall through to default */
  }

  return {
    allowed: current <= maxRequests,
    current,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetIn,
  };
}
