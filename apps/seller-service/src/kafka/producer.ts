import { createKafkaClient, createProducer } from "@repo/kafka";
import {
  SELLER_TOPICS,
  type SellerCreatedEvent,
  type SellerActivatedEvent,
  type SellerUpdatedEvent,
  type SellerSuspendedEvent,
  type SellerStorefrontUpdatedEvent,
} from "@repo/types";
import { env } from "../config/env.js";

const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
const kafkaClient = createKafkaClient("seller-service", brokers);
export const kafkaProducer = createProducer(kafkaClient);

export class SellerEventProducer {
  private connected = false;

  public async connect(): Promise<void> {
    try {
      await kafkaProducer.connect();
      this.connected = true;
    } catch {
      // In development or test where Kafka may be absent, tolerate connection failure
      this.connected = false;
    }
  }

  private async send(topic: string, payload: object): Promise<void> {
    if (!this.connected) {
      return;
    }
    try {
      await kafkaProducer.send(topic, { value: payload });
    } catch (err) {
      console.warn(`[Kafka] Warning: Failed to publish event to topic '${topic}':`, err);
    }
  }

  public async publishSellerCreated(payload: SellerCreatedEvent): Promise<void> {
    await this.send(SELLER_TOPICS.CREATED, payload);
  }

  public async publishSellerActivated(payload: SellerActivatedEvent): Promise<void> {
    await this.send(SELLER_TOPICS.ACTIVATED, payload);
  }

  public async publishSellerUpdated(payload: SellerUpdatedEvent): Promise<void> {
    await this.send(SELLER_TOPICS.UPDATED, payload);
  }

  public async publishSellerSuspended(payload: SellerSuspendedEvent): Promise<void> {
    await this.send(SELLER_TOPICS.SUSPENDED, payload);
  }

  public async publishSellerStorefrontUpdated(
    payload: SellerStorefrontUpdatedEvent
  ): Promise<void> {
    await this.send(SELLER_TOPICS.STOREFRONT_UPDATED, payload);
  }
}

export const sellerEventProducer = new SellerEventProducer();
