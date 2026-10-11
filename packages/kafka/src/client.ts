import { Kafka } from "kafkajs";

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

export const createKafkaClient = (
  service: string,
  brokers?: string[] | string,
) => {
  return new Kafka({
    clientId: service,
    brokers: resolveBrokers(brokers),
  });
};
