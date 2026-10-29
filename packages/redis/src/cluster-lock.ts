import type { Redis } from "ioredis";

/**
 * Distributed cluster lock and Redlock consensus manager.
 * Provides atomic mutual exclusion across distributed containers with safe Lua-based release
 * and majority-quorum consensus across multi-node Redis clusters.
 */

export interface ClusterLockOptions {
  /** Lock TTL in milliseconds before lease automatically expires (default: 5,000ms) */
  ttlMs?: number;
}

export interface RedlockOptions {
  /** Lock TTL in milliseconds before lease automatically expires (default: 5,000ms) */
  ttlMs?: number;
  /** Clock drift factor (default: 0.01 = 1%) */
  driftFactor?: number;
  /** Maximum retry count if lock acquisition fails initially (default: 0) */
  retryCount?: number;
  /** Delay between retries in milliseconds (default: 100ms) */
  retryDelayMs?: number;
}

export interface RedlockLease {
  key: string;
  workerId: string;
  validityMs: number;
}

const SAFE_RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const SAFE_RENEW_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

/**
 * Attempts to atomically acquire a cluster-wide leader lease on a single Redis node.
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
  try {
    const res = await client.eval(SAFE_RELEASE_LUA, 1, key, workerId);
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
  try {
    const res = await client.eval(SAFE_RENEW_LUA, 1, key, workerId, ttlMs);
    return res === 1;
  } catch {
    return false;
  }
}

/**
 * Redlock Distributed Consensus Algorithm across N independent Redis nodes/masters.
 *
 * Requirements for distributed consensus:
 * 1. Acquire the lock in majority of instances: quorum = floor(N / 2) + 1.
 * 2. Total time to acquire must be strictly less than TTL minus clock drift.
 * 3. On failure to achieve quorum, release all instances immediately.
 */
export async function acquireRedlockConsensus(
  clients: Redis[],
  key: string,
  workerId: string,
  options: RedlockOptions = {},
): Promise<RedlockLease | null> {
  if (clients.length === 0) {
    return null;
  }

  const ttlMs = options.ttlMs ?? 5000;
  const driftFactor = options.driftFactor ?? 0.01;
  const retryCount = options.retryCount ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 100;

  const quorum = Math.floor(clients.length / 2) + 1;
  const drift = Math.round(ttlMs * driftFactor) + 2;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const startTime = Date.now();
    let acquiredCount = 0;

    // Concurrently or rapidly attempt acquisition across all nodes
    const results = await Promise.allSettled(
      clients.map((c) =>
        c.set(key, workerId, "PX", ttlMs, "NX").catch(() => null),
      ),
    );

    for (const res of results) {
      if (res.status === "fulfilled" && res.value === "OK") {
        acquiredCount++;
      }
    }

    const elapsed = Date.now() - startTime;
    const validityMs = ttlMs - elapsed - drift;

    if (acquiredCount >= quorum && validityMs > 0) {
      return {
        key,
        workerId,
        validityMs,
      };
    }

    // Failed to achieve quorum: rollback and unlock all nodes
    await releaseRedlockConsensus(clients, key, workerId);

    if (attempt < retryCount) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
}

/**
 * Releases a Redlock across all configured Redis nodes using safe Lua evaluation.
 */
export async function releaseRedlockConsensus(
  clients: Redis[],
  key: string,
  workerId: string,
): Promise<boolean> {
  const results = await Promise.allSettled(
    clients.map((c) => releaseClusterLock(c, key, workerId)),
  );
  return results.some((r) => r.status === "fulfilled" && r.value === true);
}
