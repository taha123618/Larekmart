import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafkaBrokers = (
  process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
)
  .split(",")
  .map((b) => b.trim());
const kafkaClient = createKafkaClient("order-service", kafkaBrokers);

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, "order-group");
