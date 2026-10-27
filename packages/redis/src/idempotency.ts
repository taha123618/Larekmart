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

export interface IdempotencyOptions {
  /** Lock TTL in milliseconds for in-progress operations (default: 60,000ms / 1 min) */
  lockTtlMs?: number;
  /** Retention TTL in seconds for completed responses (default: 86,400s / 24 hours) */
  retentionTtlSec?: number;
}

/**
 * Attempts to atomically acquire an idempotency lock in Redis for a given key.
 *
 * - Returns `status: "acquired"` if this is the first execution attempt.
 * - Returns `status: "replayed"` with the cached response if previously completed.
 * - Returns `status: "conflict"` if an identical mutation is currently in-flight.
 * - Returns `status: "error"` if Redis is unreachable.
 */
export async function acquireIdempotencyLock(
  client: Redis,
  key: string,
  options: IdempotencyOptions = {},
): Promise<AcquireLockResult> {
  const lockTtlMs = options.lockTtlMs ?? 60000;
  const inProgressPayload: StoredIdempotencyRecord = {
    state: "IN_PROGRESS",
    createdAt: Date.now(),
  };

  try {
    // Atomic SET NX PX to claim in-flight execution
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

    // Key exists: check if in-progress or completed
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
      // Overwrite corrupted payload
      await client.set(key, JSON.stringify(inProgressPayload), "PX", lockTtlMs);
      return { status: "acquired" };
    }

    if (parsed.state === "COMPLETED" && parsed.response) {
      return { status: "replayed", response: parsed.response };
    }

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
