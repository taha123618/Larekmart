import type { Redis } from "ioredis";

/**
 * Generic typed cache helpers.
 *
 * All functions are **best-effort** — they catch and suppress Redis errors so
 * that a Redis outage never surfaces as a user-visible failure.  Callers
 * should treat `null` returns as cache misses and fall through to the source.
 */

/**
 * Retrieves a cached value and deserializes it as `T`.
 *
 * @returns The deserialized value, or `null` on miss or error.
 */
export async function cacheGet<T>(client: Redis, key: string): Promise<T | null> {
  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Serializes `value` and stores it under `key` with a TTL in seconds.
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
 * Deletes a single key.  Returns `true` if the key existed, `false` otherwise.
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
 *  - Each cache key embeds a version number: `prefix:v<N>:rest-of-key`.
 *  - Calling `bumpNamespaceVersion` increments a counter stored at
 *    `<versionKey>`.  All old keys are not deleted; they simply become
 *    unreachable (and expire naturally) once consumers start using the new
 *    version number.
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
  try {
    const newVersion = await client.incr(versionKey);
    fallback.value = newVersion;
    return newVersion;
  } catch {
    fallback.value += 1;
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
      fallback.value = parseInt(raw, 10) || fallback.value;
    }
    return fallback.value;
  } catch {
    return fallback.value;
  }
}
