import type { Redis } from "ioredis";

/**
 * Generic typed cache helpers.
 *
 * Keys are taken verbatim, so pass keys from the service's `createKeyBuilder`
 * and never add the service prefix yourself.
 */

/**
 * Outcome of a cache read.
 *
 * - `hit` — a value was stored under the key and decoded successfully
 * - `miss` — nothing usable is stored (absent, unreadable, or explicitly null)
 * - `error` — Redis could not be reached, so the answer is unknown
 *
 * Callers that report cache metrics **must count `error` separately from
 * `miss`**. Collapsing them makes a Redis outage look like a 0% hit rate, and
 * there is no way to tell a cold cache from a broken one.
 */
export type CacheReadStatus = "hit" | "miss" | "error";

/**
 * Discriminated result of `cacheRead`. The `hit` variant carries a non-null
 * value, so status checks narrow the value.
 */
export type CacheReadResult<T> =
  | { status: "hit"; value: T }
  | { status: "miss"; value: null }
  | { status: "error"; value: null };

/**
 * Reads and decodes a value, reporting whether it was a hit, a miss, or a
 * Redis failure.
 *
 * Never throws: a Redis outage is reported as `status: "error"` so the caller
 * can fall through to its source of truth *and* record that the cache was
 * unavailable. Prefer this over a plain `GET` anywhere the outcome is measured.
 */
export async function cacheRead<T>(
  client: Redis,
  key: string,
): Promise<CacheReadResult<T>> {
  let raw: string | null;

  try {
    raw = await client.get(key);
  } catch {
    return { status: "error", value: null };
  }

  if (raw === null) {
    return { status: "miss", value: null };
  }

  try {
    const decoded = JSON.parse(raw) as T | null;
    // A stored literal `null` is indistinguishable from absent data for callers.
    return decoded === null
      ? { status: "miss", value: null }
      : { status: "hit", value: decoded };
  } catch {
    // Corrupt or truncated payload: treat it as a miss so the caller
    // repopulates the key instead of serving nothing.
    return { status: "miss", value: null };
  }
}

/**
 * Serializes `value` and stores it under `key` with a TTL in seconds.
 *
 * Best-effort: a failed write is swallowed, because a cache that cannot be
 * populated must never fail the request that produced the value. Read errors are
 * what `cacheRead` reports.
 *
 * @param ttlSeconds - Time-to-live. Pass `0` for no expiry (not recommended
 *                     for ephemeral cache data).
 */
export async function cacheSet<T>(
  client: Redis,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch {
    /* non-critical — cache write failure is ignored */
  }
}

/**
 * Deletes a single key.  Returns `true` if the key existed, `false` otherwise
 * (including when Redis is unreachable).
 */
export async function cacheDel(client: Redis, key: string): Promise<boolean> {
  try {
    const count = await client.del(key);
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Atomically increments a counter stored at `key`.
 * Sets TTL on the first increment (count === 1).
 *
 * @returns The new counter value, or `null` on error.
 */
export async function cacheIncr(
  client: Redis,
  key: string,
  ttlSeconds?: number,
): Promise<number | null> {
  try {
    const value = await client.incr(key);
    if (value === 1 && ttlSeconds !== undefined && ttlSeconds > 0) {
      await client.expire(key, ttlSeconds);
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Refreshes the TTL of an existing key.
 *
 * @returns `true` if the key exists and the TTL was updated, `false` otherwise.
 */
export async function cacheExpire(
  client: Redis,
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const result = await client.expire(key, ttlSeconds);
    return result === 1;
  } catch {
    return false;
  }
}

/**
 * Namespace-versioning helper for bulk cache invalidation.
 *
 * Pattern:
 *  - Each cache key embeds a version number: `<prefix>v<N>:rest-of-key`.
 *  - Calling `bumpNamespaceVersion` advances a counter stored at `<versionKey>`.
 *    Old keys are not deleted; they simply become unreachable (and expire
 *    naturally) once consumers start using the new version number.
 *
 * The returned version must be strictly greater than **both** the stored value
 * and the caller's in-memory `fallback`; otherwise a reader still holding
 * `fallback` would keep resolving entries written before the mutation. Redis
 * starts a missing key at 0, so the very first `INCR` returns 1 — which can be
 * exactly the version readers are already holding, silently turning the first
 * invalidation into a no-op.
 *
 * So: increment by one, and only when that still lands at or below the fallback
 * (the key was lost, or the fallback advanced while Redis was unreachable) jump
 * once to exactly `fallback + 1`. Incrementing by `fallback + 1` every time also
 * satisfies the invariant, but the offset **compounds**: it roughly doubles the
 * stored value on each bump and overflows Redis's 64-bit integer after ~63
 * bumps, after which every bump takes the error path below and the version
 * stops advancing entirely. `verify-redis.ts` pins the repeated-bump behaviour.
 *
 * @param client      - Redis client.
 * @param versionKey  - Key that stores the current namespace version integer.
 * @param fallback    - In-memory fallback value mutated when Redis is down.
 * @returns           - The new version number.
 */
export async function bumpNamespaceVersion(
  client: Redis,
  versionKey: string,
  fallback: { value: number },
): Promise<number> {
  const base = Number.isFinite(fallback.value) ? Math.floor(fallback.value) : 0;

  try {
    // The stored value's own sequence, so the version grows by one per bump and
    // concurrent writers in other processes stay ordered.
    const incremented = await client.incr(versionKey);

    const target = base + 1;
    if (incremented < target) {
      // Catch up in a single jump. `target - incremented` is always positive
      // here, and the stored value still only moves forward.
      const jumped = await client.incrby(versionKey, target - incremented);
      fallback.value = jumped;
      return jumped;
    }

    fallback.value = incremented;
    return incremented;
  } catch {
    fallback.value = base + 1;
    return fallback.value;
  }
}

/**
 * Reads the current namespace version.
 *
 * @returns The version stored in Redis, or `fallback.value` on error.
 */
export async function getNamespaceVersion(
  client: Redis,
  versionKey: string,
  fallback: { value: number },
): Promise<number> {
  try {
    const raw = await client.get(versionKey);
    if (raw !== null) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        fallback.value = parsed;
      }
    }
    return fallback.value;
  } catch {
    return fallback.value;
  }
}
