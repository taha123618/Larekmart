import { consumer } from "./kafka";
import { createOrder } from "./order";

export const runKafkaSubscriptions = async () => {
  consumer.subscribe([
    {
      topicName: "payment.successful",
      topicHandler: async (message) => {
        const order = message.value;
        await createOrder(order);
      },
    },
    {
      topicName: "shipment.created",
      topicHandler: async (message) => {
        try {
          const { Order } = await import("@repo/order-db");
          const payload = message.value;
          if (payload?.orderId && payload?.trackingNumber) {
            await Order.findByIdAndUpdate(payload.orderId, {
              trackingNumber: payload.trackingNumber,
              carrier: payload.carrier,
            });
          }
        } catch (err) {
          console.warn(
            "[order-service] Failed to link shipment to order:",
            err,
          );
        }
      },
    },
  ]);
};
