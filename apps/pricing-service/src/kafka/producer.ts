import { producer } from "../utils/kafka.js";
import { db } from "../db/connection.js";
import { pricingOutbox } from "../db/schema.js";
import type {
  PriceCreatedEventPayload,
  PriceUpdatedEventPayload,
  PriceExpiredEventPayload,
  QuoteCreatedEventPayload,
} from "@repo/types";

export class PricingEventProducer {
  private connected = false;

  public async connect(): Promise<void> {
    try {
      await producer.connect();
      this.connected = true;
    } catch {
      // Allow service to operate even if Kafka is not yet ready in dev/test
      this.connected = false;
    }
  }

  private async persistOutboxOrSend(topic: string, payload: object): Promise<void> {
    try {
      await db.insert(pricingOutbox).values({
        topic,
        payload,
      });
    } catch (dbErr) {
      // Fallback to direct Kafka delivery if database outbox insert fails
      console.warn(
        `[PricingOutbox] Outbox table insert unavailable; falling back to direct Kafka dispatch:`,
        dbErr,
      );
      try {
        if (!this.connected) {
          await this.connect();
        }
        await producer.send(topic, { value: payload });
      } catch (kafkaErr) {
        console.warn(
          `[Kafka] Warning: Failed to publish event to topic '${topic}':`,
          kafkaErr,
        );
      }
    }
  }

  public async publishPriceCreated(
    payload: PriceCreatedEventPayload,
  ): Promise<void> {
    await this.persistOutboxOrSend("pricing.price.created", payload);
  }

  public async publishPriceUpdated(
    payload: PriceUpdatedEventPayload,
  ): Promise<void> {
    await this.persistOutboxOrSend("pricing.price.updated", payload);
  }

  public async publishPriceExpired(
    payload: PriceExpiredEventPayload,
  ): Promise<void> {
    await this.persistOutboxOrSend("pricing.price.expired", payload);
  }

  public async publishQuoteCreated(
    payload: QuoteCreatedEventPayload,
  ): Promise<void> {
    await this.persistOutboxOrSend("pricing.quote.created", payload);
  }
}

export const pricingEventProducer = new PricingEventProducer();
