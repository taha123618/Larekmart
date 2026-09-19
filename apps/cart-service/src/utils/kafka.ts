import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";

const kafkaClient = createKafkaClient("cart-service");

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, "cart-service-group");
