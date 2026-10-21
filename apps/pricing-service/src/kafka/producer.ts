import { producer } from "../utils/kafka.js";
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

  private async send(topic: string, payload: object): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }
      await producer.send(topic, { value: payload });
    } catch (err) {
      console.warn(
        `[Kafka] Warning: Failed to publish event to topic '${topic}':`,
        err,
      );
    }
  }

  public async publishPriceCreated(
    payload: PriceCreatedEventPayload,
  ): Promise<void> {
    await this.send("pricing.price.created", payload);
  }

  public async publishPriceUpdated(
    payload: PriceUpdatedEventPayload,
  ): Promise<void> {
    await this.send("pricing.price.updated", payload);
  }

  public async publishPriceExpired(
    payload: PriceExpiredEventPayload,
  ): Promise<void> {
    await this.send("pricing.price.expired", payload);
  }

  public async publishQuoteCreated(
    payload: QuoteCreatedEventPayload,
  ): Promise<void> {
    await this.send("pricing.quote.created", payload);
  }
}

export const pricingEventProducer = new PricingEventProducer();
