import { consumer } from "../utils/kafka.js";
import { taxEventProducer } from "./producers/tax.producer.js";
import { handleOrderCreatedEvent } from "./consumers/order.consumer.js";
import {
  handleProductTaxCategoryUpdatedEvent,
  handleTaxRulesUpdatedEvent,
} from "./consumers/product.consumer.js";

export async function startKafka(): Promise<void> {
  try {
    await taxEventProducer.connect();
    await consumer.connect();

    await consumer.subscribe([
      {
        topicName: "order.created",
        topicHandler: handleOrderCreatedEvent,
      },
      {
        topicName: "product.tax-category.updated",
        topicHandler: handleProductTaxCategoryUpdatedEvent,
      },
      {
        topicName: "tax.rules.updated",
        topicHandler: handleTaxRulesUpdatedEvent,
      },
    ]);

    console.log("[Kafka] Tax service consumers connected and running");
  } catch (err) {
    console.warn("[Kafka] Warning: Kafka connection deferred or failed:", err);
  }
}
