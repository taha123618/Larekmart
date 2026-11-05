import { createKafkaClient, createProducer } from "@repo/kafka";
import {
  COMMISSION_TOPICS,
  type CommissionCalculatedEvent,
  type CommissionAccruedEvent,
  type CommissionAdjustedEvent,
  type CommissionReversedEvent,
} from "@repo/types";
import { env } from "../config/env.js";

const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
const kafkaClient = createKafkaClient(env.KAFKA_CLIENT_ID, brokers);
export const kafkaProducer = createProducer(kafkaClient);

export class CommissionEventProducer {
  private connected = false;

  public async connect(): Promise<void> {
    try {
      await kafkaProducer.connect();
      this.connected = true;
    } catch (err) {
      console.warn(
        "[CommissionKafka] Kafka broker unavailable at startup; events will queue or drop gracefully in test/dev:",
        err instanceof Error ? err.message : String(err),
      );
      this.connected = false;
    }
  }

  private async send(
    topic: string,
    payload: object,
    key?: string,
  ): Promise<void> {
    if (!this.connected) return;
    try {
      await kafkaProducer.send(topic, { value: payload }, { key });
    } catch (err) {
      console.warn(
        `[CommissionKafka] Failed to publish event to '${topic}':`,
        err,
      );
    }
  }

  public async publishCommissionCalculated(
    payload: CommissionCalculatedEvent,
  ): Promise<void> {
    await this.send(COMMISSION_TOPICS.CALCULATED, payload, payload.orderId);
  }

  public async publishCommissionAccrued(
    payload: CommissionAccruedEvent,
  ): Promise<void> {
    await this.send(COMMISSION_TOPICS.ACCRUED, payload, payload.orderId);
  }

  public async publishCommissionAdjusted(
    payload: CommissionAdjustedEvent,
  ): Promise<void> {
    await this.send(COMMISSION_TOPICS.ADJUSTED, payload, payload.orderId);
  }

  public async publishCommissionReversed(
    payload: CommissionReversedEvent,
  ): Promise<void> {
    await this.send(COMMISSION_TOPICS.REVERSED, payload, payload.orderId);
  }
}

export const commissionEventProducer = new CommissionEventProducer();
