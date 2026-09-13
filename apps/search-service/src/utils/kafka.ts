import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafkaClient = createKafkaClient("search-service");

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, "search-service-group");
