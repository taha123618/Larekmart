import { Kafka } from "kafkajs";

if (
  typeof process !== "undefined" &&
  process.env &&
  !process.env.KAFKAJS_NO_PARTITIONER_WARNING
) {
  process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";
}

/**
 * Broker addresses, in order of preference:
 * 1. `KAFKA_BROKERS` env var (comma-separated) — used by services that
 *    configure custom or single brokers.
 * 2. The three local development brokers bound to 127.0.0.1 (see
 *    packages/kafka/AGENTS.md).
 */
function resolveBrokers(brokers?: string[] | string): string[] {
  if (Array.isArray(brokers) && brokers.length > 0) {
    return brokers.map((b) => b.trim()).filter((b) => b.length > 0);
  }
  if (typeof brokers === "string" && brokers.trim().length > 0) {
    return brokers
      .split(",")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
  }

  return ["localhost:9094", "localhost:9095", "localhost:9096"];
}

export interface KafkaClientCustomOptions {
  connectionTimeout?: number;
  requestTimeout?: number;
}

export const createKafkaClient = (
  service: string,
  brokers?: string[] | string,
  options?: KafkaClientCustomOptions,
) => {
  const connectionTimeout =
    options?.connectionTimeout ??
    (process.env.KAFKA_CONNECTION_TIMEOUT
      ? Number(process.env.KAFKA_CONNECTION_TIMEOUT)
      : 10_000);

  const requestTimeout =
    options?.requestTimeout ??
    (process.env.KAFKA_REQUEST_TIMEOUT
      ? Number(process.env.KAFKA_REQUEST_TIMEOUT)
      : 30_000);

  return new Kafka({
    clientId: service,
    brokers: resolveBrokers(brokers),
    connectionTimeout,
    requestTimeout,
    retry: {
      initialRetryTime: 300,
      maxRetryTime: 30_000,
      retries: 8,
    },
  });
};
