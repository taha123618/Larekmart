import type { Redis } from "ioredis";

export type IdempotencyState = "IN_PROGRESS" | "COMPLETED";

export interface IdempotentResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface StoredIdempotencyRecord {
  state: IdempotencyState;
  createdAt: number;
  completedAt?: number;
  response?: IdempotentResponse;
}

export type AcquireLockResult =
  | { status: "acquired" }
  | { status: "conflict"; message: string }
  | { status: "replayed"; response: IdempotentResponse }
  | { status: "error"; message: string };

export const DEFAULT_LOCK_TTL_MS = 10000; // 10 seconds strict auto-expiry threshold
export const DEFAULT_RETENTION_TTL_SEC = 86400; // 24 hours

export interface IdempotencyOptions {
  /** Lock TTL in milliseconds for in-progress operations (default: 10,000ms / 10s strict threshold) */
  lockTtlMs?: number;
  /** Retention TTL in seconds for completed responses (default: 86,400s / 24 hours) */
  retentionTtlSec?: number;
}

/**
 * Attempts to atomically acquire an idempotency lock in Redis for a given key.
 *
 * - Returns `status: "acquired"` if this is the first execution attempt or if a previous
 *   in-flight attempt timed out / leaked due to a crashed worker.
 * - Returns `status: "replayed"` with the cached response if previously completed.
 * - Returns `status: "conflict"` if an identical mutation is actively in-flight within its strict TTL.
 * - Returns `status: "error"` if Redis is unreachable.
 */
export async function acquireIdempotencyLock(
  client: Redis,
  key: string,
  options: IdempotencyOptions = {},
): Promise<AcquireLockResult> {
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const inProgressPayload: StoredIdempotencyRecord = {
    state: "IN_PROGRESS",
    createdAt: Date.now(),
  };

  try {
    // 1. Atomic SET NX PX to claim in-flight execution with strict auto-expire lease
    const acquired = await client.set(
      key,
      JSON.stringify(inProgressPayload),
      "PX",
      lockTtlMs,
      "NX",
    );

    if (acquired === "OK") {
      return { status: "acquired" };
    }

    // 2. Key exists: inspect existing record
    const raw = await client.get(key);
    if (!raw) {
      // Key expired between the SET attempt and GET; retry acquisition
      const retryAcquired = await client.set(
        key,
        JSON.stringify(inProgressPayload),
        "PX",
        lockTtlMs,
        "NX",
      );
      if (retryAcquired === "OK") {
        return { status: "acquired" };
      }
      return {
        status: "conflict",
        message: "A mutation with this Idempotency-Key is currently in-flight",
      };
    }

    let parsed: StoredIdempotencyRecord;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Overwrite corrupted payload with fresh auto-expiring lease
      await client.set(key, JSON.stringify(inProgressPayload), "PX", lockTtlMs);
      return { status: "acquired" };
    }

    // 3. Transparent replay for completed mutations
    if (parsed.state === "COMPLETED" && parsed.response) {
      return { status: "replayed", response: parsed.response };
    }

    // 4. In-progress state detected: verify if the lock is dangling or stale
    // (e.g. if the processing service crashed mid-flight without committing or releasing)
    const pttl = await client.pttl(key);
    const elapsedMs = parsed.createdAt
      ? Date.now() - parsed.createdAt
      : lockTtlMs;
    const isStale =
      pttl === -1 || // Key has no expiration set -> dangling un-expiring lock
      pttl <= 0 || // Key already expired
      elapsedMs >= lockTtlMs; // Wall-clock time exceeds strict lock lease

    if (isStale) {
      // Worker crashed mid-flight. Reclaim the lock atomically with a fresh strict lease.
      const reclaimed = await client.set(
        key,
        JSON.stringify(inProgressPayload),
        "PX",
        lockTtlMs,
      );
      if (reclaimed === "OK") {
        return { status: "acquired" };
      }
    }

    // Lock is actively in-flight within valid strict TTL lease
    return {
      status: "conflict",
      message: "A mutation with this Idempotency-Key is currently in-flight",
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Commits the completed response into Redis with a durable retention TTL.
 * Subsequent calls with the identical key will receive this cached response.
 */
export async function commitIdempotencyResponse(
  client: Redis,
  key: string,
  response: IdempotentResponse,
  options: IdempotencyOptions = {},
): Promise<boolean> {
  const retentionTtlSec = options.retentionTtlSec ?? 86400; // 24 hours
  const completedPayload: StoredIdempotencyRecord = {
    state: "COMPLETED",
    createdAt: Date.now(),
    completedAt: Date.now(),
    response,
  };

  try {
    const res = await client.set(
      key,
      JSON.stringify(completedPayload),
      "EX",
      retentionTtlSec,
    );
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Releases the in-progress idempotency lock in Redis (e.g. when a downstream
 * database transaction fails or throws an exception). Allows the client to retry.
 */
export async function releaseIdempotencyLock(
  client: Redis,
  key: string,
): Promise<boolean> {
  try {
    const deleted = await client.del(key);
    return deleted > 0;
  } catch {
    return false;
  }
}
