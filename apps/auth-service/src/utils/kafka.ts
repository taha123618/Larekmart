import { createKafkaClient, createProducer } from "@repo/kafka";

const kafkaBrokers = (
  process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
)
  .split(",")
  .map((b) => b.trim());
const kafka = createKafkaClient("auth-service", kafkaBrokers);
export const producer = createProducer(kafka);
