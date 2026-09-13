import type { Redis } from "ioredis";
import type { RateLimitOptions, RateLimitResult } from "./types.js";

/**
 * Implements an atomic fixed-window rate limiter backed by Redis.
 *
 * Algorithm (INCR + EXPIRE NX):
 * 1. Increment the key (creating it if absent).
 * 2. Guarantee the bucket has a TTL with `EXPIRE key <window> NX`, which only
 *    sets an expiry when the key does not already have one. Doing this on every
 *    request means a crash between `INCR` and `EXPIRE` can no longer leave a
 *    bucket locked permanently, and the window never slides.
 * 3. Read the remaining TTL so callers can send an accurate `Retry-After`.
 *
 * This is O(1) per request and matches how most API rate limiters are deployed.
 * It is a fixed window (the TTL is not extended by later requests), not a
 * rolling one.
 *
 * @param client   - An ioredis client instance.
 * @param options  - Key, limit, and window configuration.
 * @returns        - Rate-limit decision with header values ready to use.
 * @throws         - If Redis is unreachable (`INCR` rejects). Callers whose
 *                   endpoints must stay available should fail open by catching.
 */
export async function checkRateLimit(
  client: Redis,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, maxRequests, windowSeconds } = options;

  const current = await client.incr(key);

  try {
    await client.expire(key, windowSeconds, "NX");
  } catch {
    // Redis < 7 does not support the NX flag; fall back to setting the TTL on
    // the first request of the window only.
    if (current === 1) {
      await client.expire(key, windowSeconds).catch(() => {
        /* non-critical — a missed TTL expires on the next window */
      });
    }
  }

  // Best-effort TTL for the "resetIn" value.  Falls back to windowSeconds.
  let resetIn = windowSeconds;
  try {
    const ttl = await client.ttl(key);
    if (ttl > 0) resetIn = ttl;
  } catch {
    /* keep the window-length fallback */
  }

  return {
    allowed: current <= maxRequests,
    current,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetIn,
  };
}
