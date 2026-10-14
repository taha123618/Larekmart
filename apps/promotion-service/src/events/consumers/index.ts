import { consumer } from "../../utils/kafka.js";
import {
  handleOrderConfirmed,
  handleOrderCancelled,
} from "./order-events.consumer.js";
import { logger } from "../../observability/metrics.js";

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "order.confirmed",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderConfirmed(msg.value);
        },
      },
      {
        topicName: "order.completed",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderConfirmed(msg.value);
        },
      },
      {
        topicName: "order.cancelled",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderCancelled(msg.value);
        },
      },
    ]);
    logger.info(
      "promotion-service Kafka consumers successfully connected and subscribed.",
    );
  } catch (err) {
    logger.warn("Kafka consumer connection deferred / offline:", { err });
  }
}
