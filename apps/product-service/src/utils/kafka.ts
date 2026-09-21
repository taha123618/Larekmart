import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("product-service:kafka");

const kafkaClient = createKafkaClient("product-service");

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, "product-group");

/**
 * KafkaJS rejects with plain objects rather than `Error` instances, so
 * `String(error)` would only ever log "[object Object]".
 */
const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
};

/**
 * Publishes a domain event without letting a broker outage fail the write that
 * produced it.
 *
 * `producer.send` rethrows, and callers deliberately do not await it so a slow
 * broker cannot add latency to product/category writes. A bare unawaited `send`
 * would therefore reject with nothing listening, which terminates the process —
 * every publish has to go through here.
 */
export const publishEvent = (topic: string, value: unknown): void => {
  producer.send(topic, { value }).catch((error: unknown) => {
    // `Logger.error` is (message, error, metadata) — passing the message text as
    // the second argument keeps the broker's reason readable in the log line.
    logger.error(
      `Failed to publish to Kafka topic [${topic}]`,
      describeError(error),
      {
        topic,
      },
    );
  });
};
