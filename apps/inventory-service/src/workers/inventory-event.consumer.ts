import { confirmReservationsByReference } from "@repo/inventory-db";
import { PaymentSuccessfulType } from "@repo/types";
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
          }
        } catch (error) {
          logger.error(
            "Error processing payment.successful Kafka message in inventory-service",
            error,
          );
        }
      },
    },
  ]);
}
