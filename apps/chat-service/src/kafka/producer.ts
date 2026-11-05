import { createKafkaClient, createProducer } from "@repo/kafka";
import {
  CHAT_KAFKA_TOPICS,
  ChatMessageCreatedEvent,
  ChatMessageReportedEvent,
  ChatConversationCreatedEvent,
} from "@repo/types";
import { env } from "../config/env.js";

const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
const kafkaClient = createKafkaClient("chat-service", brokers);
export const kafkaProducer = createProducer(kafkaClient);

let isConnected = false;

export async function connectKafkaProducer(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  try {
    await kafkaProducer.connect();
    isConnected = true;
    console.log("[ChatService:Kafka] Producer connected successfully.");
  } catch (err) {
    console.warn("[ChatService:Kafka] Producer connection warning:", err);
    isConnected = false;
  }
}

export async function closeKafkaProducer(): Promise<void> {
  if (isConnected) {
    await kafkaProducer.disconnect().catch(() => {});
    isConnected = false;
  }
}

export async function publishChatMessageCreated(
  event: ChatMessageCreatedEvent,
): Promise<void> {
  if (!isConnected) return;
  try {
    await kafkaProducer.send(CHAT_KAFKA_TOPICS.MESSAGE_CREATED, {
      value: event,
    });
  } catch (err) {
    console.warn("[ChatService:Kafka] Failed to publish message created:", err);
  }
}

export async function publishChatMessageReported(
  event: ChatMessageReportedEvent,
): Promise<void> {
  if (!isConnected) return;
  try {
    await kafkaProducer.send(CHAT_KAFKA_TOPICS.MESSAGE_REPORTED, {
      value: event,
    });
  } catch (err) {
    console.warn("[ChatService:Kafka] Failed to publish message reported:", err);
  }
}

export async function publishChatConversationCreated(
  event: ChatConversationCreatedEvent,
): Promise<void> {
  if (!isConnected) return;
  try {
    await kafkaProducer.send(CHAT_KAFKA_TOPICS.CONVERSATION_CREATED, {
      value: event,
    });
  } catch (err) {
    console.warn("[ChatService:Kafka] Failed to publish conversation created:", err);
  }
}
