import type { Redis } from "ioredis";

/**
 * Default Read-Your-Writes consistency lease duration in milliseconds.
 * 500ms provides sufficient overhead for PostgreSQL WAL replication log propagation
 * to catch up to read-replica instances while minimizing primary writer load.
 */
export const DEFAULT_RYW_TTL_MS = 500;

export const RYW_PREFIX = "ryw:";

export interface ReadYourWritesOptions {
  /**
   * Lease TTL in milliseconds (default: 500ms).
   */
  ttlMs?: number;
  /**
   * Optional key namespace prefix (default: "ryw:").
   */
  prefix?: string;
}

/**
 * Builds the Redis key tracking client-session mutation lease.
 */
export function buildReadYourWritesKey(
  clientId: string,
  prefix = RYW_PREFIX,
): string {
  const cleanId = clientId.trim();
  return `${prefix}${cleanId}`;
}

/**
 * Registers a temporary Read-Your-Writes lease in Redis for a client session.
 * Forces subsequent read requests from this client to query the primary master pool directly,
 * bypassing asynchronous read-replicas until replication lag catches up.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom TTL and prefix options.
 * @returns True if the lease was successfully set in Redis.
 */
export async function markReadYourWrites(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) {
    return false;
  }
  const ttlMs = options?.ttlMs ?? DEFAULT_RYW_TTL_MS;
  const key = buildReadYourWritesKey(clientId, options?.prefix);
  try {
    const res = await client.set(key, Date.now().toString(), "PX", ttlMs);
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Redis key prefix for LSN-based Read-Your-Writes tracking.
 */
export const RYW_LSN_PREFIX = "ryw:lsn:";

/**
 * Builds the Redis key for storing the session WAL LSN checkpoint.
 */
export function buildReadYourWritesLsnKey(
  clientId: string,
  prefix = RYW_LSN_PREFIX,
): string {
  const cleanId = clientId.trim();
  return `${prefix}${cleanId}`;
}

/**
 * Stores the PostgreSQL WAL LSN high-water mark for a client session in Redis.
 * Used in conjunction with the time-based RYW lease to enforce LSN-aware read routing.
 *
 * When a mutation occurs (write to primary), the caller retrieves
 * `pg_current_wal_lsn()` from PostgreSQL and caches it here.
 * Subsequent read requests from the same session compare this LSN against
 * the read-replica's current replay position to determine whether it is safe
 * to serve from replica or whether the primary must be queried directly.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param lsn - The WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4").
 * @param options - Custom TTL and prefix options. TTL defaults to 30 seconds to
 *                  survive heavy batch replication lag windows.
 * @returns True if the LSN was successfully cached in Redis.
 */
export async function markReadYourWritesWithLSN(
  client: Redis,
  clientId: string,
  lsn: string,
  options?: ReadYourWritesOptions & { lsnTtlMs?: number },
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) return false;
  if (!lsn || lsn.trim().length === 0) return false;

  // LSN lease survives longer than the time-based lease (default 30s)
  // to cover heavy batch replication lag windows on 11.11-style write storms.
  const ttlMs = options?.lsnTtlMs ?? 30_000;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    const res = await client.set(key, lsn.trim(), "PX", ttlMs);
    // Also refresh the time-based lease in parallel
    await markReadYourWrites(client, clientId, options);
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Retrieves the cached WAL LSN high-water mark for the client session.
 * Returns null if no LSN was cached or the key has expired.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom prefix options.
 * @returns The LSN string (e.g. "0/1A2B3C4") or null.
 */
export async function getSessionLSN(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<string | null> {
  if (!clientId || clientId.trim().length === 0) return null;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Parses a PostgreSQL WAL LSN string ("A/BBBBBBBB") into a BigInt for numeric comparison.
 * Returns 0n if the string is malformed or empty.
 *
 * @param lsn - WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4" or "16/B374D848").
 */
export function parseLSN(lsn: string): bigint {
  if (!lsn || typeof lsn !== "string") return 0n;
  const parts = lsn.trim().split("/");
  if (parts.length !== 2) return 0n;
  try {
    const high = BigInt("0x" + parts[0]);
    const low = BigInt("0x" + parts[1]);
    return (high << 32n) | low;
  } catch {
    return 0n;
  }
}

/**
 * Checks whether the client session currently has an active Read-Your-Writes lease.
 * Returns true if the client recently executed a mutation within the replication lag window.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom prefix options.
 * @returns True if a valid unexpired lease exists.
 */
export async function isReadYourWritesActive(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) {
    return false;
  }
  const key = buildReadYourWritesKey(clientId, options?.prefix);
  try {
    const exists = await client.exists(key);
    return exists === 1;
  } catch {
    return false;
  }
}

/**
 * Redis key prefix for LSN-based Read-Your-Writes tracking.
 */
export const RYW_LSN_PREFIX = "ryw:lsn:";

/**
 * Builds the Redis key for storing the session WAL LSN checkpoint.
 */
export function buildReadYourWritesLsnKey(
  clientId: string,
  prefix = RYW_LSN_PREFIX,
): string {
  const cleanId = clientId.trim();
  return `${prefix}${cleanId}`;
}

/**
 * Stores the PostgreSQL WAL LSN high-water mark for a client session in Redis.
 * Used in conjunction with the time-based RYW lease to enforce LSN-aware read routing.
 *
 * When a mutation occurs (write to primary), the caller retrieves
 * `pg_current_wal_lsn()` from PostgreSQL and caches it here.
 * Subsequent read requests from the same session compare this LSN against
 * the read-replica's current replay position to determine whether it is safe
 * to serve from replica or whether the primary must be queried directly.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param lsn - The WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4").
 * @param options - Custom TTL and prefix options. TTL defaults to 30 seconds to
 *                  survive heavy batch replication lag windows.
 * @returns True if the LSN was successfully cached in Redis.
 */
export async function markReadYourWritesWithLSN(
  client: Redis,
  clientId: string,
  lsn: string,
  options?: ReadYourWritesOptions & { lsnTtlMs?: number },
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) return false;
  if (!lsn || lsn.trim().length === 0) return false;

  // LSN lease survives longer than the time-based lease (default 30s)
  // to cover heavy batch replication lag windows on 11.11-style write storms.
  const ttlMs = options?.lsnTtlMs ?? 30_000;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    const res = await client.set(key, lsn.trim(), "PX", ttlMs);
    // Also refresh the time-based lease in parallel
    await markReadYourWrites(client, clientId, options);
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Retrieves the cached WAL LSN high-water mark for the client session.
 * Returns null if no LSN was cached or the key has expired.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom prefix options.
 * @returns The LSN string (e.g. "0/1A2B3C4") or null.
 */
export async function getSessionLSN(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<string | null> {
  if (!clientId || clientId.trim().length === 0) return null;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Parses a PostgreSQL WAL LSN string ("A/BBBBBBBB") into a BigInt for numeric comparison.
 * Returns 0n if the string is malformed or empty.
 *
 * @param lsn - WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4" or "16/B374D848").
 */
export function parseLSN(lsn: string): bigint {
  if (!lsn || typeof lsn !== "string") return 0n;
  const parts = lsn.trim().split("/");
  if (parts.length !== 2) return 0n;
  try {
    const high = BigInt("0x" + parts[0]);
    const low = BigInt("0x" + parts[1]);
    return (high << 32n) | low;
  } catch {
    return 0n;
  }
}

/**
 * Voluntarily clears the Read-Your-Writes lease for a client session.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom prefix options.
 * @returns True if an existing lease was removed.
 */
export async function clearReadYourWrites(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) {
    return false;
  }
  const key = buildReadYourWritesKey(clientId, options?.prefix);
  try {
    const res = await client.del(key);
    return res > 0;
  } catch {
    return false;
  }
}

/**
 * Redis key prefix for LSN-based Read-Your-Writes tracking.
 */
export const RYW_LSN_PREFIX = "ryw:lsn:";

/**
 * Builds the Redis key for storing the session WAL LSN checkpoint.
 */
export function buildReadYourWritesLsnKey(
  clientId: string,
  prefix = RYW_LSN_PREFIX,
): string {
  const cleanId = clientId.trim();
  return `${prefix}${cleanId}`;
}

/**
 * Stores the PostgreSQL WAL LSN high-water mark for a client session in Redis.
 * Used in conjunction with the time-based RYW lease to enforce LSN-aware read routing.
 *
 * When a mutation occurs (write to primary), the caller retrieves
 * `pg_current_wal_lsn()` from PostgreSQL and caches it here.
 * Subsequent read requests from the same session compare this LSN against
 * the read-replica's current replay position to determine whether it is safe
 * to serve from replica or whether the primary must be queried directly.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param lsn - The WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4").
 * @param options - Custom TTL and prefix options. TTL defaults to 30 seconds to
 *                  survive heavy batch replication lag windows.
 * @returns True if the LSN was successfully cached in Redis.
 */
export async function markReadYourWritesWithLSN(
  client: Redis,
  clientId: string,
  lsn: string,
  options?: ReadYourWritesOptions & { lsnTtlMs?: number },
): Promise<boolean> {
  if (!clientId || clientId.trim().length === 0) return false;
  if (!lsn || lsn.trim().length === 0) return false;

  // LSN lease survives longer than the time-based lease (default 30s)
  // to cover heavy batch replication lag windows on 11.11-style write storms.
  const ttlMs = options?.lsnTtlMs ?? 30_000;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    const res = await client.set(key, lsn.trim(), "PX", ttlMs);
    // Also refresh the time-based lease in parallel
    await markReadYourWrites(client, clientId, options);
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Retrieves the cached WAL LSN high-water mark for the client session.
 * Returns null if no LSN was cached or the key has expired.
 *
 * @param client - The active Redis client.
 * @param clientId - The user ID, session token, or client IP.
 * @param options - Custom prefix options.
 * @returns The LSN string (e.g. "0/1A2B3C4") or null.
 */
export async function getSessionLSN(
  client: Redis,
  clientId: string,
  options?: ReadYourWritesOptions,
): Promise<string | null> {
  if (!clientId || clientId.trim().length === 0) return null;
  const key = buildReadYourWritesLsnKey(clientId, options?.prefix ? `${options.prefix}lsn:` : RYW_LSN_PREFIX);
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Parses a PostgreSQL WAL LSN string ("A/BBBBBBBB") into a BigInt for numeric comparison.
 * Returns 0n if the string is malformed or empty.
 *
 * @param lsn - WAL LSN string from PostgreSQL (e.g. "0/1A2B3C4" or "16/B374D848").
 */
export function parseLSN(lsn: string): bigint {
  if (!lsn || typeof lsn !== "string") return 0n;
  const parts = lsn.trim().split("/");
  if (parts.length !== 2) return 0n;
  try {
    const high = BigInt("0x" + parts[0]);
    const low = BigInt("0x" + parts[1]);
    return (high << 32n) | low;
  } catch {
    return 0n;
  }
}
