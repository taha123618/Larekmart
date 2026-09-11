import type { Kafka, Consumer } from "kafkajs";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

export const createConsumer = (kafka: Kafka, groupId: string) => {
  const logger = createLogger(`kafka-consumer:${groupId}`);
  const consumer: Consumer = kafka.consumer({ groupId });

  const connect = async () => {
    try {
      await consumer.connect();
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
      await consumer.subscribe({
        topics: topics.map((topic) => topic.topicName),
        fromBeginning: true,
      });

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
