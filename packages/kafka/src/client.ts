import { Kafka } from "kafkajs";

export const createKafkaClient = (service: string) => {
  return new Kafka({
    clientId: service,
    brokers: ["localhost:9094", "localhost:9095", "localhost:9096"],
  });
};

// import { Kafka } from "kafkajs";

// /**
//  * Broker addresses, in order of preference:
//  * 1. `KAFKA_BROKERS` env var (comma-separated) — used by media-service, which
//  *    needs a configurable single broker for containerized deployments.
//  * 2. The three local development brokers bound to 127.0.0.1 (see
//  *    packages/kafka/AGENTS.md — brokers must never be exposed on 0.0.0.0).
//  */
// function resolveBrokers(): string[] {
//   const fromEnv = process.env.KAFKA_BROKERS;
//   if (fromEnv && fromEnv.trim().length > 0) {
//     return fromEnv
//       .split(",")
//       .map((broker) => broker.trim())
//       .filter((broker) => broker.length > 0);
//   }
//   return ["localhost:9094", "localhost:9095", "localhost:9096"];
// }

// export const createKafkaClient = (service: string) => {
//   return new Kafka({
//     clientId: service,
//     brokers: resolveBrokers(),
//   });
// };
