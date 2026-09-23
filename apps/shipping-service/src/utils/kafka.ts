import { createConsumer, createKafkaClient, createProducer } from "@repo/kafka";
import { env } from "../config/env.js";

const kafkaClient = createKafkaClient(env.KAFKA_CLIENT_ID);

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, env.KAFKA_GROUP_ID);
