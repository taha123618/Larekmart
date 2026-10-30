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
