import { consumer } from "../utils/kafka.js";
import { handleOrderDelivered } from "./order.consumer.js";
import { handleProductDeleted } from "./product.consumer.js";
import { handleUserDeleted } from "./user.consumer.js";

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "order.completed",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderDelivered(msg.value);
        },
      },
      {
        topicName: "order-successful",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderDelivered(msg.value);
        },
      },
      {
        topicName: "shipment.delivered",
        topicHandler: async (msg) => {
          if (msg.value) await handleOrderDelivered(msg.value);
        },
      },
      {
        topicName: "product.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleProductDeleted(msg.value);
        },
      },
      {
        topicName: "user.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleUserDeleted(msg.value);
        },
      },
    ]);
    console.log(
      "review-service Kafka consumers successfully connected and subscribed.",
    );
  } catch (err) {
    console.warn("Kafka consumer connection deferred / offline:", err);
  }
}
