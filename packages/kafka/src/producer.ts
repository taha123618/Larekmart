import type { Kafka, Producer } from "kafkajs";
import {
  createLogger,
  captureError,
  measureAsync,
  injectTraceContext,
} from "@repo/monitoring";
import { schemaRegistry } from "./schema-registry/client.js";

const logger = createLogger("kafka-producer");

export interface KafkaSendOptions {
  key?: string;
  headers?: Record<string, string | Buffer>;
  schemaId?: number;
}

export const createProducer = (kafka: Kafka) => {
  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30_000,
  });

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

  const send = async (
    topic: string,
    message: object,
    options?: KafkaSendOptions,
  ) => {
    try {
      await measureAsync(`kafka.send.${topic}`, async () => {
        const headers: Record<string, string | Buffer> = {
          ...options?.headers,
        };
        // Automatically inject active W3C traceparent into Kafka message headers
        injectTraceContext(headers as Record<string, string>);

        const value =
          options?.schemaId !== undefined
            ? schemaRegistry.encodeMessage(options.schemaId, message)
            : JSON.stringify(message);

        await producer.send({
          topic,
          messages: [
            {
              key: options?.key,
              value,
              headers,
            },
          ],
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

export type KafkaProducer = ReturnType<typeof createProducer>;
