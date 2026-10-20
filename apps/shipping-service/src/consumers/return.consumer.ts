import { ShippingPublisher } from "../publishers/shipping.publisher.js";
import type { ReturnShipmentRequestedPayload } from "@repo/types";

export const returnTopicHandlers = [
  {
    topicName: "return.shipment.requested",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topicHandler: async (message: any) => {
      try {
        const payload = message.value as ReturnShipmentRequestedPayload;
        if (!payload || !payload.returnId) {
          console.warn(
            "[ReturnConsumer] Received return.shipment.requested event without returnId, skipping",
          );
          return;
        }

        console.log(
          `[ReturnConsumer] Processing return.shipment.requested for return ${payload.returnId}`,
        );

        // Generate return tracking number & prepaid shipping label
        const carrier = "TCS Express";
        const trackingNumber = `RET-TCS-${payload.returnId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const labelUrl = `https://labels.larekmart.com/prepaid-returns/${payload.returnId}.pdf`;
        const shipmentId = `ret_ship_${payload.returnId}`;

        // Publish shipping.label.created (consumed by return-service to transition state)
        await ShippingPublisher.publishReturnLabelCreated({
          returnId: payload.returnId,
          shipmentId,
          trackingNumber,
          carrierName: carrier,
          labelUrl,
        });

        console.log(
          `[ReturnConsumer] Generated return label for return ${payload.returnId} (Carrier: ${carrier}, Tracking: ${trackingNumber})`,
        );
      } catch (err) {
        console.error(
          "[ReturnConsumer] Failed to process return.shipment.requested:",
          err,
        );
      }
    },
  },
];
