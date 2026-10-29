import type { Redis } from "ioredis";

/**
 * Distributed cluster lock / leader lease manager.
 * Provides atomic mutual exclusion across distributed containers with safe Lua-based release.
 */

export interface ClusterLockOptions {
  /** Lock TTL in milliseconds before lease automatically expires (default: 5,000ms) */
  ttlMs?: number;
}

/**
 * Attempts to atomically acquire a cluster-wide leader lease for a given key and workerId.
 * Uses atomic Redis SET NX PX.
 * Returns true if this worker successfully acquired the lease, false if held by another worker.
 */
export async function acquireClusterLock(
  client: Redis,
  key: string,
  workerId: string,
  options: ClusterLockOptions = {},
): Promise<boolean> {
  const ttlMs = options.ttlMs ?? 5000;
  try {
    const res = await client.set(key, workerId, "PX", ttlMs, "NX");
    return res === "OK";
  } catch {
    return false;
  }
}

/**
 * Atomically releases a cluster lock using a Lua script to ensure that
 * a worker ONLY deletes the lock if it still holds the lease.
 * Prevents race conditions where a slow worker deletes another worker's new lock.
 */
export async function releaseClusterLock(
  client: Redis,
  key: string,
  workerId: string,
): Promise<boolean> {
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try {
    const res = await client.eval(luaScript, 1, key, workerId);
    return res === 1;
  } catch {
    return false;
  }
}

/**
 * Renews an existing cluster lock if the worker still holds it.
 */
export async function renewClusterLock(
  client: Redis,
  key: string,
  workerId: string,
  ttlMs = 5000,
): Promise<boolean> {
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  try {
    const res = await client.eval(luaScript, 1, key, workerId, ttlMs);
    return res === 1;
  } catch {
    return false;
  }
}

