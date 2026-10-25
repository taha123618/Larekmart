import {
  confirmReservationsByReference,
  listInventoryItems,
  restockInventory,
} from "@repo/inventory-db";
import {
  PaymentSuccessfulType,
  ReturnInspectionCompletedPayload,
} from "@repo/types";
import { invalidateInventoryCache } from "../cache/inventory-cache.js";
import { inventoryMetrics, logger } from "../observability/metrics.js";
import { consumer, producer } from "../utils/kafka.js";
import { verifyPaidCheckoutSession } from "../utils/stripe-verify.js";

/**
 * Subscribes to cross-service payment and order Kafka events to synchronize inventory state.
 *
 * Golden Rule #3: Cross-service communication is strictly asynchronous via Kafka.
 * When a checkout completes in payment-service (Stripe webhook), this consumer automatically
 * confirms matching inventory reservations (converting reserved stock to sold stock)
 * and dispatches inventory confirmation/sold events.
 */
export async function startInventoryEventConsumer(): Promise<void> {
  logger.info("Initializing inventory Kafka event consumer...");

  await consumer.subscribe([
    {
      topicName: "payment.successful",
      topicHandler: async (message) => {
        try {
          const payload = message.value as PaymentSuccessfulType;
          if (!payload) return;

          const referenceId =
            payload.reservationId || payload.sessionId || payload.referenceId;
          if (!referenceId) {
            logger.info(
              "payment.successful event received without reservation/session reference, skipping",
            );
            return;
          }

          logger.info(
            `Processing payment.successful event for reference: ${referenceId}`,
          );

          // Application-level producer verification: never trust the event
          // alone. The reference must be a checkout session that Stripe
          // itself reports as paid before any stock changes hands.
          const verification = await verifyPaidCheckoutSession(referenceId);
          if (!verification.verified) {
            logger.warn(
              `Rejected payment.successful for reference ${referenceId}: ${verification.reason}`,
            );
            inventoryMetrics.paymentVerificationRejectedTotal.inc();
            await producer.send("inventory.reservation.failed", {
              value: {
                reservationId: referenceId,
                referenceId: payload.sessionId || payload.referenceId,
                reason: "VERIFICATION_REJECTED",
                details:
                  verification.reason ||
                  "Stripe paid session verification failed",
                occurredAt: new Date().toISOString(),
              },
            });
            return;
          }

          const confirmed = await confirmReservationsByReference(
            referenceId,
            payload.userId ?? undefined,
          );

          if (confirmed.length > 0) {
            inventoryMetrics.reservationsConfirmedTotal.inc(
              {},
              confirmed.length,
            );
            await invalidateInventoryCache();

            for (const item of confirmed) {
              try {
                await producer.send("inventory.stock.sold", {
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
                    occurredAt: new Date().toISOString(),
                    reservationId: item.id,
                    referenceType: item.referenceType,
                    referenceId: item.referenceId,
                  },
                });
              } catch (pubErr) {
                logger.error(
                  "Failed to publish inventory.stock.sold event",
                  pubErr,
                );
              }
            }

            logger.info(
              `Successfully confirmed ${confirmed.length} reservations for reference: ${referenceId}`,
            );
          } else {
            logger.info(
              `No active reservations found matching reference: ${referenceId}`,
            );
            await producer.send("inventory.reservation.failed", {
              value: {
                reservationId: referenceId,
                referenceId: payload.sessionId || payload.referenceId,
                reason: "NOT_FOUND",
                details: `No active reservation found matching reference: ${referenceId}`,
                occurredAt: new Date().toISOString(),
              },
            });
          }
        } catch (error) {
          logger.error(
            "Error processing payment.successful Kafka message in inventory-service",
            error,
          );
        }
      },
    },
    {
      topicName: "return.inspection.completed",
      topicHandler: async (message) => {
        try {
          const payload = message.value as ReturnInspectionCompletedPayload;
          if (
            !payload ||
            !payload.restockableItems ||
            payload.restockableItems.length === 0
          ) {
            return;
          }

          logger.info(
            `Processing return.inspection.completed for return: ${payload.returnId} (${payload.restockableItems.length} restockable items)`,
          );

          let restockedCount = 0;
          for (const item of payload.restockableItems) {
            const numericProductId = parseInt(item.productId, 10);
            if (isNaN(numericProductId) || item.quantity <= 0) continue;

            const existingItems = await listInventoryItems({
              productId: numericProductId,
            });
            if (existingItems.length > 0) {
              const invItem = existingItems[0]!;
              await restockInventory(
                {
                  productId: invItem.productId,
                  variantId: invItem.variantId,
                  warehouseId: invItem.warehouseId,
                },
                item.quantity,
                {
                  referenceType: "RETURN",
                  referenceId: payload.returnId,
                  reason: `Warehouse return inspection restock (RMA #${payload.returnId})`,
                },
              );
              restockedCount++;

              try {
                await producer.send("inventory.restocked", {
                  value: {
                    productId: invItem.productId,
                    variantId: invItem.variantId,
                    warehouseId: invItem.warehouseId,
                    quantity: item.quantity,
                    returnId: payload.returnId,
                    occurredAt: new Date().toISOString(),
                  },
                });
              } catch (pubErr) {
                logger.warn("Failed to publish inventory.restocked event", {
                  error:
                    pubErr instanceof Error ? pubErr.message : String(pubErr),
                });
              }
            }
          }

          if (restockedCount > 0) {
            await invalidateInventoryCache();
            logger.info(
              `Successfully restocked ${restockedCount} item(s) for return: ${payload.returnId}`,
            );
          }
        } catch (error) {
          logger.error(
            "Error processing return.inspection.completed Kafka message in inventory-service",
            error,
          );
        }
      },
    },
  ]);
}
