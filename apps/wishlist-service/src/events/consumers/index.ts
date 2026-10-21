import { consumer } from "../../utils/kafka.js";
import {
  handlePriceUpdated,
  handleProductDeleted,
} from "./product-events.consumer.js";
import { handleInventoryChanged } from "./inventory-events.consumer.js";
import { handleUserDeleted } from "./user-events.consumer.js";
import { logger } from "../../observability/metrics.js";

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "product.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handlePriceUpdated(msg.value);
        },
      },
      {
        topicName: "price.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handlePriceUpdated(msg.value);
        },
      },
      {
        topicName: "pricing.price.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handlePriceUpdated(msg.value);
        },
      },
      {
        topicName: "product.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleProductDeleted(msg.value);
        },
      },
      {
        topicName: "inventory.availability.changed",
        topicHandler: async (msg) => {
          if (msg.value) await handleInventoryChanged(msg.value);
        },
      },
      {
        topicName: "inventory.adjusted",
        topicHandler: async (msg) => {
          if (msg.value) await handleInventoryChanged(msg.value);
        },
      },
      {
        topicName: "user.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleUserDeleted(msg.value);
        },
      },
    ]);
    logger.info(
      "wishlist-service Kafka consumers successfully connected and subscribed.",
    );
  } catch (err) {
    logger.warn("Kafka consumer connection deferred / offline:", { err });
  }
}
