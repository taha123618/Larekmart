import { createKafkaClient, createProducer } from "@repo/kafka";

const kafka = createKafkaClient("auth-service");
export const producer = createProducer(kafka);
