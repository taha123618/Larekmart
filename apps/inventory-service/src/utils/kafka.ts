import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafkaBrokers = (
  process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
)
  .split(",")
  .map((b) => b.trim());
const kafkaClient = createKafkaClient("inventory-service", kafkaBrokers);

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(
  kafkaClient,
  process.env.KAFKA_GROUP_ID ?? "inventory-service-group",
);
