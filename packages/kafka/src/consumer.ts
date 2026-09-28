import type { Kafka, Consumer } from "kafkajs";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

/** Delay before the first retry; doubles on every attempt. */
const RETRY_BASE_DELAY_MS = 2_000;
/** Upper bound so a permanently down broker does not back off into a hang. */
const RETRY_MAX_DELAY_MS = 30_000;
/** Total retry budget; startup keeps failing loudly after this. */
const RETRY_MAX_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createConsumer = (kafka: Kafka, groupId: string) => {
  const logger = createLogger(`kafka-consumer:${groupId}`);
  const consumer: Consumer = kafka.consumer({ groupId });

  const retry = async <T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === RETRY_MAX_ATTEMPTS) break;
        const delay = Math.min(
          RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
          RETRY_MAX_DELAY_MS,
        );
        logger.warn(
          `Kafka consumer ${context} failed (attempt ${attempt}/${RETRY_MAX_ATTEMPTS}); retrying in ${delay}ms`,
          { error: String(error) },
        );
        await sleep(delay);
      }
    }
    throw lastError;
  };

  const connect = async () => {
    try {
      await retry(() => consumer.connect(), "connect");
      logger.info(`Kafka consumer connected for group [${groupId}]`);
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.connect",
      });
      throw error;
    }
  };

  const subscribe = async (
    topics: {
      topicName: string;
      topicHandler: (message: any) => Promise<void>;
    }[],
  ) => {
    try {
      await retry(
        () =>
          consumer.subscribe({
            topics: topics.map((topic) => topic.topicName),
            fromBeginning: true,
          }),
        "subscribe",
      );

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const topicConfig = topics.find((t) => t.topicName === topic);
            if (topicConfig) {
              const value = message.value?.toString();

              if (value) {
                const parsed = JSON.parse(value);
                await measureAsync(`kafka.handle.${topic}`, async () => {
                  await topicConfig.topicHandler(parsed);
                });
              }
            }
          } catch (error) {
            captureError(error, {
              serviceName: `kafka-consumer:${groupId}`,
              logger,
              context: `consumer.message:${topic}:partition-${partition}`,
            });
          }
        },
      });
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.subscribe",
      });
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      await consumer.disconnect();
      logger.info(`Kafka consumer disconnected for group [${groupId}]`);
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.disconnect",
      });
      throw error;
    }
  };

  return { connect, subscribe, disconnect };
};
