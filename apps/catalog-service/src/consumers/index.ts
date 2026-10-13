import { consumer } from "../utils/kafka.js";
import { logger } from "../observability/metrics.js";
import {
  handleProductCreated,
  handleProductUpdated,
  handleProductDeleted,
  handleRatingSummaryUpdated,
} from "./product.consumer.js";
import {
  handleCategoryCreated,
  handleCategoryUpdated,
  handleCategoryDeleted,
} from "./category.consumer.js";
import { handleInventoryAdjusted } from "./inventory.consumer.js";

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "product.created",
        topicHandler: async (msg) => {
          if (msg.value) await handleProductCreated(msg.value);
        },
      },
      {
        topicName: "product.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handleProductUpdated(msg.value);
        },
      },
      {
        topicName: "product.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleProductDeleted(msg.value);
        },
      },
      {
        topicName: "category.created",
        topicHandler: async (msg) => {
          if (msg.value) await handleCategoryCreated(msg.value);
        },
      },
      {
        topicName: "category.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handleCategoryUpdated(msg.value);
        },
      },
      {
        topicName: "category.deleted",
        topicHandler: async (msg) => {
          if (msg.value) await handleCategoryDeleted(msg.value);
        },
      },
      {
        topicName: "inventory.adjusted",
        topicHandler: async (msg) => {
          if (msg.value) await handleInventoryAdjusted(msg.value);
        },
      },
      {
        topicName: "inventory.restocked",
        topicHandler: async (msg) => {
          if (msg.value) await handleInventoryAdjusted(msg.value);
        },
      },
      {
        topicName: "inventory.low_stock",
        topicHandler: async (msg) => {
          if (msg.value) await handleInventoryAdjusted(msg.value);
        },
      },
      {
        topicName: "product.rating-summary.updated",
        topicHandler: async (msg) => {
          if (msg.value) await handleRatingSummaryUpdated(msg.value);
        },
      },
    ]);
    logger.info(
      "Catalog Kafka consumers successfully connected and subscribed",
    );
  } catch (err) {
    logger.warn("Kafka consumer connection deferred / offline", {
      error: String(err),
    });
  }
}
