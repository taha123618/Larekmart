import { consumer } from "./kafka";
import {
  createOrder,
  confirmOrder,
  cancelOutOfStockOrder,
  markOrderRefunded,
} from "./order";

export const runKafkaSubscriptions = async () => {
  consumer.subscribe([
    {
      topicName: "payment.successful",
      topicHandler: async (message) => {
        const order = message.value;
        if (order) await createOrder(order);
      },
    },
    {
      topicName: "inventory.stock.sold",
      topicHandler: async (message) => {
        const payload = message.value;
        if (payload) await confirmOrder(payload);
      },
    },
    {
      topicName: "inventory.reservation.failed",
      topicHandler: async (message) => {
        const payload = message.value;
        if (payload) await cancelOutOfStockOrder(payload);
      },
    },
    {
      topicName: "payment.refund.completed",
      topicHandler: async (message) => {
        const payload = message.value;
        if (payload) await markOrderRefunded(payload);
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
              status: "shipped",
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
    {
      topicName: "return.completed",
      topicHandler: async (message) => {
        try {
          const { Order } = await import("@repo/order-db");
          const payload = message.value;
          if (payload?.orderId) {
            await Order.findByIdAndUpdate(payload.orderId, {
              status: "refunded",
            });
            console.log(
              `[order-service] Order ${payload.orderId} marked refunded via return.completed`,
            );
          }
        } catch (err) {
          console.warn(
            "[order-service] Failed to update order on return.completed:",
            err,
          );
        }
      },
    },
  ]);
};
