import os from "node:os";
import { randomUUID } from "node:crypto";
import { expireStaleReservations } from "@repo/inventory-db";
import { withClusterLock } from "@repo/redis";
import { invalidateInventoryCache } from "../cache/inventory-cache.js";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { producer } from "../utils/kafka.js";
import { redisStockGatekeeper } from "../gatekeeper/redis-stock-gatekeeper.js";
import { redis } from "../utils/redis.js";

const WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "inventory-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
const INVENTORY_RESERVATION_LEADER_KEY = "inventory:reservation:expiry:leader";

/**
 * Starts a background worker that periodically sweeps and releases expired checkout reservations.
 *
 * This ensures that abandoned checkouts automatically return reserved units back to available stock
 * in PostgreSQL and emit Kafka expiration events without requiring manual administrative intervention.
 */
export function startReservationExpiryWorker(
  intervalMs = Number.parseInt(
    process.env.RESERVATION_EXPIRY_SWEEP_INTERVAL_MS ?? "60000",
    10,
  ),
): () => void {
  if (intervalMs <= 0) {
    logger.info("Reservation expiry background worker is disabled");
    return () => {};
  }

  logger.info(
    `Starting reservation expiry background worker (interval: ${intervalMs}ms)`,
  );

  let isRunning = false;

  const sweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await withClusterLock(
        redis.client,
        INVENTORY_RESERVATION_LEADER_KEY,
        WORKER_ID,
        async () => {
          const expiredList = await expireStaleReservations();
          if (expiredList.length > 0) {
            inventoryMetrics.reservationsExpiredTotal.inc(
              {},
              expiredList.length,
            );
            await invalidateInventoryCache();

            for (const item of expiredList) {
              await redisStockGatekeeper.incrementStockCounter(
                {
                  productId: item.inventoryItem.productId,
                  variantId: item.inventoryItem.variantId,
                  warehouseId: item.inventoryItem.warehouseId,
                },
                item.quantity,
              );
              await invalidateInventoryCache(
                item.inventoryItem.productId,
                item.inventoryItem.variantId,
              );
              try {
                await producer.send("inventory.reservation.expired", {
                  value: {
                    inventoryItemId: item.inventoryItemId,
                    productId: item.inventoryItem.productId,
                    variantId: item.inventoryItem.variantId,
                    warehouseId: item.inventoryItem.warehouseId,
                    quantity: item.inventoryItem.quantity,
                    availableQuantity: item.inventoryItem.availableQuantity,
                    reservedQuantity: item.inventoryItem.reservedQuantity,
                    soldQuantity: item.inventoryItem.soldQuantity,
                    status: item.inventoryItem.status,
                    reservationId: item.id,
                    referenceType: item.referenceType,
                    referenceId: item.referenceId,
                    occurredAt: new Date().toISOString(),
                  },
                });
              } catch (pubErr) {
                logger.error(
                  "Failed to publish reservation expired event",
                  pubErr,
                );
              }
            }

            logger.info(
              `Automated sweep released ${expiredList.length} expired reservations`,
            );
          }
        },
        { ttlMs: Math.max(15000, intervalMs - 5000) },
      );
    } catch (error) {
      logger.error("Error during automated reservation expiry sweep", error);
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(sweep, intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
