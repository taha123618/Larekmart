import { expireStaleReservations } from "@repo/inventory-db";
import { invalidateInventoryCache } from "../cache/inventory-cache.js";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { producer } from "../utils/kafka.js";

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
      const expiredList = await expireStaleReservations();
      if (expiredList.length > 0) {
        inventoryMetrics.reservationsExpiredTotal.inc({}, expiredList.length);
        await invalidateInventoryCache();

        for (const item of expiredList) {
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
            logger.error("Failed to publish reservation expired event", pubErr);
          }
        }

        logger.info(
          `Automated sweep released ${expiredList.length} expired reservations`,
        );
      }
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
