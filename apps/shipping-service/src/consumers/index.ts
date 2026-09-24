import { consumer } from "../utils/kafka.js";
import { orderTopicHandlers } from "./order.consumer.js";
import { paymentTopicHandlers } from "./payment.consumer.js";

/**
 * Starts all shipping-service event consumers in a single atomic subscription.
 *
 * Calling consumer.subscribe once with all topic configs prevents the KafkaJS error:
 * "KafkaJSNonRetriableError: Cannot subscribe to topic while consumer is running".
 */
export const startShippingConsumers = async () => {
  const allHandlers = [...orderTopicHandlers, ...paymentTopicHandlers];
  console.log(
    `[ShippingConsumers] Subscribing to ${allHandlers.length} Kafka topics:`,
    allHandlers.map((h) => h.topicName),
  );
  await consumer.subscribe(allHandlers);
};
