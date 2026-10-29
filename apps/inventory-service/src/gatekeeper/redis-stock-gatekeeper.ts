import { getInventoryItem } from "@repo/inventory-db";
import { createClusterHashTag } from "@repo/redis";
import { logger, inventoryMetrics } from "../observability/metrics.js";
import { redis } from "../utils/redis.js";
import { writeCentralizedStockCache } from "../cache/inventory-cache.js";

export type PrecheckResult =
  | { success: true; remainingQuantity: number }
  | { success: false; reason: "INSUFFICIENT_STOCK"; availableQuantity: number }
  | { success: false; reason: "ITEM_NOT_FOUND" };

/**
 * Atomic reservation pre-check Lua script.
 * KEYS[1]: stock:available:{tenant_id:warehouse_id}:productId:variantId
 * KEYS[2]: stock:claim:{tenant_id:warehouse_id}:referenceId
 * ARGV[1]: requestedQuantity
 * ARGV[2]: claimTtlSeconds
 *
 * Both keys MUST share the exact same hash tag {...} so Redis Cluster
 * hashes them to the same slot (CRC16), avoiding CROSSSLOT errors.
 */
const RESERVE_LUA = `
local currentStock = redis.call('GET', KEYS[1])
if not currentStock then
  return { -1, 0 }
end
local stock = tonumber(currentStock)
local requested = tonumber(ARGV[1])
if stock < requested then
  return { 0, stock }
end
local remaining = redis.call('DECRBY', KEYS[1], requested)
redis.call('SET', KEYS[2], requested, 'EX', ARGV[2])
return { 1, remaining }
`;

/**
 * Compensation rollback Lua script.
 * KEYS[1]: stock:available:{tenant_id:warehouse_id}:productId:variantId
 * KEYS[2]: stock:claim:{tenant_id:warehouse_id}:referenceId
 * ARGV[1]: fallbackQuantity
 */
const ROLLBACK_LUA = `
local claimed = redis.call('GET', KEYS[2])
local qtyToRestore = 0
if claimed then
  qtyToRestore = tonumber(claimed)
  redis.call('DEL', KEYS[2])
else
  qtyToRestore = tonumber(ARGV[1] or 0)
end
if qtyToRestore > 0 then
  local exists = redis.call('EXISTS', KEYS[1])
  if exists == 1 then
    redis.call('INCRBY', KEYS[1], qtyToRestore)
  end
end
return qtyToRestore
`;

const INCREMENT_LUA = `
local exists = redis.call('EXISTS', KEYS[1])
if exists == 1 then
  return redis.call('INCRBY', KEYS[1], ARGV[1])
end
return -1
`;

export interface GatekeeperItemKey {
  productId: number;
  variantId: string;
  warehouseId: string;
  tenantId?: string;
}

export class RedisStockGatekeeper {
  /**
   * Generates deterministic Redis Cluster Hash Tag {tenant_id:warehouse_id}.
   * If warehouseId already contains '{...}', it is preserved.
   * If tenantId is provided: '{tenantId:warehouseId}'
   * Otherwise: '{warehouseId}' (e.g. '{pk_khi_01}')
   */
  public getClusterHashTag(warehouseId: string, tenantId?: string): string {
    if (warehouseId.startsWith("{") && warehouseId.endsWith("}")) {
      return warehouseId;
    }
    if (tenantId) {
      return createClusterHashTag(tenantId, warehouseId);
    }
    return createClusterHashTag(warehouseId);
  }

  /**
   * Deterministic cluster key blueprint:
   * stock:available:{tenant_id:warehouse_id}:productId:variantId
   * E.g. stock:available:{pk_khi_01}:prod_9981:var_002
   */
  public getStockKey(key: GatekeeperItemKey): string {
    const tag = this.getClusterHashTag(key.warehouseId, key.tenantId);
    return `stock:available:${tag}:${key.productId}:${key.variantId}`;
  }

  /**
   * Deterministic cluster claim key blueprint:
   * stock:claim:{tenant_id:warehouse_id}:referenceId
   * Shares the exact same hash tag {tag} as getStockKey, guaranteeing execution on the identical cluster slot.
   */
  public getClaimKey(
    referenceId: string,
    tagOrKey: GatekeeperItemKey | string,
  ): string {
    const tag =
      typeof tagOrKey === "string"
        ? this.getClusterHashTag(tagOrKey)
        : this.getClusterHashTag(tagOrKey.warehouseId, tagOrKey.tenantId);
    return `stock:claim:${tag}:${referenceId}`;
  }

  /**
   * Mutex lock key for cold cache warming:
   * stock:lock:{tenant_id:warehouse_id}:productId:variantId
   */
  public getLockKey(key: GatekeeperItemKey): string {
    const tag = this.getClusterHashTag(key.warehouseId, key.tenantId);
    return `stock:lock:${tag}:${key.productId}:${key.variantId}`;
  }

  /**
   * Pre-checks stock availability in Redis using an atomic Lua script.
   * If stock is insufficient, fast-rejects in <1ms without touching PostgreSQL.
   * If stock is available, decrements the counter and registers a temporary claim token.
   * If cold cache (key missing), lazily warms up ground truth from PostgreSQL with a distributed mutex.
   *
   * Cluster Safe: Both stockKey and claimKey share the exact hash tag {tenant_id:warehouse_id},
   * preventing cross-slot errors in Redis Cluster sharding deployments.
   */
  async precheckAndClaim(params: {
    itemKey: GatekeeperItemKey;
    quantity: number;
    referenceId: string;
    claimTtlSeconds?: number;
  }): Promise<PrecheckResult> {
    const { itemKey, quantity, referenceId, claimTtlSeconds = 60 } = params;
    const stockKey = this.getStockKey(itemKey);
    const claimKey = this.getClaimKey(referenceId, itemKey);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rawResult = (await redis.client.eval(
          RESERVE_LUA,
          2,
          stockKey,
          claimKey,
          String(quantity),
          String(claimTtlSeconds),
        )) as [number, number];

        const [code, value] = rawResult;

        if (code === 1) {
          // Success: counter decremented, claim registered
          inventoryMetrics.gatekeeperClaimsTotal.inc();
          return { success: true, remainingQuantity: value };
        }

        if (code === 0) {
          // Insufficient stock: Fast reject
          inventoryMetrics.gatekeeperFastRejectsTotal.inc();
          inventoryMetrics.oversellPreventedTotal.inc();
          return {
            success: false,
            reason: "INSUFFICIENT_STOCK",
            availableQuantity: value,
          };
        }

        if (code === -1) {
          // Cold cache: Warm up from PostgreSQL
          const warmUpSuccess = await this.warmUpFromDatabase(itemKey);
          if (!warmUpSuccess) {
            return { success: false, reason: "ITEM_NOT_FOUND" };
          }
          // Loop and retry Lua evaluation with populated cache
          continue;
        }
      } catch (err) {
        logger.warn(
          "Redis Gatekeeper precheck failed, falling back to database evaluation",
          { error: err instanceof Error ? err.message : String(err) },
        );
        // Fallback gracefully: allow PostgreSQL transaction to evaluate directly
        return { success: true, remainingQuantity: 0 };
      }
    }

    // Default fallback if warm-up retries were exhausted
    return { success: true, remainingQuantity: 0 };
  }

  /**
   * Lazily loads ground-truth availableQuantity from PostgreSQL into Redis using a distributed mutex.
   */
  private async warmUpFromDatabase(key: GatekeeperItemKey): Promise<boolean> {
    const lockKey = this.getLockKey(key);
    const stockKey = this.getStockKey(key);

    try {
      // Acquire 2-second mutex to prevent concurrent thundering herd to DB
      const acquired = await redis.client.set(lockKey, "1", "PX", 2000, "NX");

      if (acquired === "OK") {
        try {
          const item = await getInventoryItem(key);
          if (!item || item.status === "INACTIVE") {
            return false;
          }

          // Cache availableQuantity with a 1-hour rolling TTL
          await redis.client.set(
            stockKey,
            String(item.availableQuantity),
            "EX",
            3600,
          );
          // Keep centralized cache in sync
          await writeCentralizedStockCache(
            key.productId,
            item.availableQuantity,
            key.variantId,
          );
          return true;
        } finally {
          await redis.client.del(lockKey);
        }
      } else {
        // Another instance is loading, wait briefly before retrying
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      }
    } catch (error) {
      logger.error("Failed to warm up inventory gatekeeper cache", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Finalizes a reservation claim upon successful PostgreSQL commit.
   * Cleans up the temporary claim token.
   */
  async finalizeClaim(
    referenceId: string,
    tagOrKey?: GatekeeperItemKey | string,
  ): Promise<void> {
    try {
      if (tagOrKey) {
        const claimKey = this.getClaimKey(referenceId, tagOrKey);
        await redis.client.del(claimKey);
      }
      // Also delete legacy un-tagged key if present
      const legacyKey = redis.keys.namespace("stock", "claim", referenceId);
      await redis.client.del(legacyKey);
    } catch (error) {
      logger.warn("Failed to finalize gatekeeper claim token", {
        referenceId,
        error,
      });
    }
  }

  /**
   * Compensates and restores claimed stock in Redis if PostgreSQL transaction fails.
   */
  async rollbackClaim(params: {
    itemKey: GatekeeperItemKey;
    referenceId: string;
    quantity: number;
  }): Promise<void> {
    const { itemKey, referenceId, quantity } = params;
    const stockKey = this.getStockKey(itemKey);
    const claimKey = this.getClaimKey(referenceId, itemKey);

    try {
      inventoryMetrics.gatekeeperRollbacksTotal.inc();
      await redis.client.eval(
        ROLLBACK_LUA,
        2,
        stockKey,
        claimKey,
        String(quantity),
      );
      logger.info("Rolled back Redis gatekeeper stock claim", {
        itemKey,
        referenceId,
        quantity,
      });
    } catch (error) {
      logger.error("Failed to rollback Redis gatekeeper stock claim", {
        itemKey,
        referenceId,
        error,
      });
    }
  }

  /**
   * Increments the Redis stock counter when an active reservation is released, cancelled, or expired.
   */
  async incrementStockCounter(
    key: GatekeeperItemKey,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;
    const stockKey = this.getStockKey(key);

    try {
      const updatedStock = (await redis.client.eval(
        INCREMENT_LUA,
        1,
        stockKey,
        String(quantity),
      )) as number;

      if (updatedStock >= 0) {
        await writeCentralizedStockCache(
          key.productId,
          updatedStock,
          key.variantId,
        );
      }
    } catch (error) {
      logger.warn("Failed to increment Redis gatekeeper stock counter", {
        key,
        quantity,
        error,
      });
    }
  }

  /**
   * Directly sets or syncs the stock counter in Redis (e.g. after restock or adjustment).
   */
  async setStockCounter(
    key: GatekeeperItemKey,
    quantity: number,
  ): Promise<void> {
    const stockKey = this.getStockKey(key);
    try {
      await redis.client.set(stockKey, String(quantity), "EX", 3600);
      await writeCentralizedStockCache(key.productId, quantity, key.variantId);
    } catch (error) {
      logger.warn("Failed to set Redis gatekeeper stock counter", {
        key,
        quantity,
        error,
      });
    }
  }

  /**
   * Invalidates the stock counter in Redis (forces lazy reload on next reservation).
   */
  async invalidateCounter(key: GatekeeperItemKey): Promise<void> {
    const stockKey = this.getStockKey(key);
    try {
      await redis.client.del(stockKey);
    } catch (error) {
      logger.warn("Failed to invalidate Redis gatekeeper stock counter", {
        key,
        error,
      });
    }
  }
}

export const redisStockGatekeeper = new RedisStockGatekeeper();
