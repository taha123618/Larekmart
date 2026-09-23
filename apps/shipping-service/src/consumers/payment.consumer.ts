import { consumer } from "../utils/kafka.js";
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { TrackingService } from "../services/tracking.service.js";
import { ShipmentStatus } from "@repo/shipping-db";
import type { PaymentSuccessfulType } from "@repo/types";

export const startPaymentConsumer = async () => {
  await consumer.subscribe([
    {
      topicName: "payment.successful",
      topicHandler: async (message) => {
        try {
          const payload = message.value as PaymentSuccessfulType;
          if (!payload) return;

          const orderReference = payload.referenceId || payload.sessionId;
          if (!orderReference) return;

          console.log(
            `[PaymentConsumer] Processing payment.successful for reference ${orderReference}`,
          );

          const shipment =
            await ShipmentRepository.findByOrderId(orderReference);
          if (shipment && shipment.status === ShipmentStatus.PENDING) {
            await ShipmentRepository.updateStatus(
              shipment.id,
              ShipmentStatus.READY_TO_SHIP,
            );

            await TrackingService.recordTrackingEvent({
              shipmentId: shipment.id,
              status: "READY_TO_SHIP",
              description:
                "Payment confirmed. Package prepared for carrier collection.",
              source: "manual",
              metadata: {
                paymentAmount: payload.amount,
                sessionId: payload.sessionId,
              },
            });

            console.log(
              `[PaymentConsumer] Shipment ${shipment.id} transitioned to READY_TO_SHIP`,
            );
          }
        } catch (error) {
          console.error(
            "[PaymentConsumer] Error handling payment.successful message:",
            error,
          );
        }
      },
    },
  ]);
};
