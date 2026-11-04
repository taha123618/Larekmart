import {
  batchReserveInventory,
  type ReserveInventoryInput,
} from "@repo/inventory-db";
import type { InventoryReservationRequestedPayload } from "@repo/types";
import { invalidateInventoryCache } from "../cache/inventory-cache.js";
import { publish, publishItemEvent } from "../events/inventory-publisher.js";
import { redisStockGatekeeper } from "../gatekeeper/redis-stock-gatekeeper.js";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { batchConsumer } from "../utils/kafka.js";

/**
 * High-Throughput Reservation Batch Worker.
 *
 * Consumes `inventory.reservation.requested` events in micro-batches (up to 50 items)
 * using `@repo/kafka` subscribeBatch().
 *
 * Coalesces database row updates by SKU to drastically reduce row-level lock contention
 * in PostgreSQL during viral flash sales, while maintaining zero-oversell guarantees.
 */
export async function startReservationBatchWorker(): Promise<void> {
  logger.info("Initializing inventory reservation micro-batch worker...");

  await batchConsumer.subscribeBatch([
    {
      topicName: "inventory.reservation.requested",
      batchSize: 50,
      topicHandler: async (messages) => {
        if (!messages || messages.length === 0) return;

        logger.debug(
          `Reservation batch worker processing ${messages.length} messages`,
        );

        const inputs: ReserveInventoryInput[] = [];

        for (const msg of messages) {
          const payload = msg.value as InventoryReservationRequestedPayload;
          if (
            !payload ||
            !payload.productId ||
            !payload.referenceId ||
            !payload.quantity
          ) {
            logger.warn(
              "Encountered malformed reservation request message in batch, skipping",
              { payload },
            );
            continue;
          }

          inputs.push({
            productId: payload.productId,
            variantId: payload.variantId,
            warehouseId: payload.warehouseId,
            quantity: payload.quantity,
            referenceType: payload.referenceType,
            referenceId: payload.referenceId,
            userId: payload.userId,
            expiresAt: new Date(payload.expiresAt),
          });
        }

        if (inputs.length === 0) return;

        const batchResult = await batchReserveInventory(inputs);

        // 1. Process successful reservations: finalize Redis claims, invalidate caches, publish events
        for (const item of batchResult.successful) {
          const itemKey = {
            productId: item.input.productId,
            variantId: item.input.variantId,
            warehouseId: item.input.warehouseId,
          };

          try {
            await redisStockGatekeeper.finalizeClaim(
              item.input.referenceId,
              itemKey,
            );
          } catch (finalizeErr) {
            logger.warn(
              "Failed to finalize Redis gatekeeper claim during batch processing",
              {
                referenceId: item.input.referenceId,
                error: finalizeErr,
              },
            );
          }

          await invalidateInventoryCache(
            item.reservation.inventoryItem.productId,
            item.reservation.inventoryItem.variantId,
          );

          await publishItemEvent(
            "inventory.reserved",
            item.reservation.inventoryItem,
            {
              reservationId: item.reservation.id,
              quantity: item.reservation.quantity,
              referenceType: item.reservation.referenceType,
              referenceId: item.reservation.referenceId,
              expiresAt: item.reservation.expiresAt.toISOString(),
            },
          );
        }

        // 2. Process failed reservations: compensation rollback in Redis & dispatch failure events
        for (const item of batchResult.failed) {
          const itemKey = {
            productId: item.input.productId,
            variantId: item.input.variantId,
            warehouseId: item.input.warehouseId,
          };

          inventoryMetrics.oversellPreventedTotal.inc();

          try {
            await redisStockGatekeeper.rollbackClaim({
              itemKey,
              referenceId: item.input.referenceId,
              quantity: item.input.quantity,
            });
          } catch (rollbackErr) {
            logger.error(
              "Failed to rollback Redis gatekeeper claim on batch persistence failure",
              {
                referenceId: item.input.referenceId,
                error: rollbackErr,
              },
            );
          }

          await publish(
            "inventory.reservation.failed",
            {
              reservationId: item.input.referenceId,
              referenceId: item.input.referenceId,
              productId: item.input.productId,
              variantId: item.input.variantId,
              reason: "INSUFFICIENT_STOCK",
              details: item.error.message,
              occurredAt: new Date().toISOString(),
            },
            item.input.referenceId,
          );
        }

        logger.debug(
          `Batch reservation settlement complete: ${batchResult.successful.length} committed, ${batchResult.failed.length} failed/rolled back`,
        );
      },
    },
  ]);

  logger.info(
    "Inventory reservation micro-batch worker subscribed to inventory.reservation.requested",
  );
}
