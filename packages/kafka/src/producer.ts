import type { Kafka, Producer } from "kafkajs";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

const logger = createLogger("kafka-producer");

export const createProducer = (kafka: Kafka) => {
  const producer: Producer = kafka.producer();

  const connect = async () => {
    try {
      await producer.connect();
      logger.info("Kafka producer connected successfully");
    } catch (error) {
      captureError(error, {
        serviceName: "kafka-producer",
        logger,
        context: "producer.connect",
      });
      throw error;
    }
  };

  const send = async (topic: string, message: object) => {
    try {
      await measureAsync(`kafka.send.${topic}`, async () => {
        await producer.send({
          topic,
          messages: [{ value: JSON.stringify(message) }],
        });
      });
      logger.debug(`Kafka message sent to topic [${topic}]`);
    } catch (error) {
      captureError(error, {
        serviceName: "kafka-producer",
        logger,
        context: `producer.send:${topic}`,
      });
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      await producer.disconnect();
      logger.info("Kafka producer disconnected");
    } catch (error) {
      captureError(error, {
        serviceName: "kafka-producer",
        logger,
        context: "producer.disconnect",
      });
      throw error;
    }
  };

  return { connect, send, disconnect };
};
