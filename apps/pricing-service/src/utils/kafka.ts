import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";
import { env } from "../config/env.js";

const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());

const kafkaClient = createKafkaClient("pricing-service", brokers);

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, env.KAFKA_GROUP_ID);
