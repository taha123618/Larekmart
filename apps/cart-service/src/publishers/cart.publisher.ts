import type { CartEventName, CartEventPayloadType } from "@repo/types";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../observability/metrics.js";
import { producer, consumer } from "../utils/kafka.js";

export { producer, consumer };

let isProducerConnected = false;

export const connectKafka = async (): Promise<void> => {
  try {
    await producer.connect();
    isProducerConnected = true;
    logger.info("Cart service Kafka producer connected");
  } catch (err) {
    logger.warn("Kafka producer connection deferred / failed", {
      error: String(err),
    });
  }
};

export const disconnectKafka = async (): Promise<void> => {
  try {
    if (isProducerConnected) {
      await producer.disconnect();
      isProducerConnected = false;
    }
  } catch (err) {
    logger.warn("Error disconnecting Kafka producer", { error: String(err) });
  }
};

export const publishCartEvent = async (
  eventType: CartEventName,
  data: Omit<CartEventPayloadType, "eventId" | "eventType" | "timestamp">,
): Promise<void> => {
  const payload: CartEventPayloadType = {
    eventId: `evt_${uuidv4()}`,
    eventType,
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }

    await producer.send(eventType, { value: payload });
    logger.info("Published cart event to Kafka", {
      eventType,
      cartId: data.cartId,
    });
  } catch (err) {
    logger.error("Failed to publish cart event to Kafka", err as Error, {
      eventType,
      cartId: data.cartId,
    });
  }
};
