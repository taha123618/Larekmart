import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafkaClient = createKafkaClient("catalog-service");

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, "catalog-service-group");
