import { producer } from "../../utils/kafka.js";
import type {
  TaxCalculationCompletedEventPayload,
  TaxCalculationFailedEventPayload,
  TaxCalculationVoidedEventPayload,
  TaxRulesUpdatedEventPayload,
  TaxCalculationAdjustedEventPayload,
} from "@repo/types";

export class TaxEventProducer {
  private connected = false;

  public async connect(): Promise<void> {
    try {
      await producer.connect();
      this.connected = true;
    } catch {
      // Allow service to operate even if Kafka is not yet ready
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

  public async publishTaxCalculationCompleted(
    payload: TaxCalculationCompletedEventPayload,
  ): Promise<void> {
    await this.send("tax.calculation.completed", payload);
  }

  public async publishTaxCalculationFailed(
    payload: TaxCalculationFailedEventPayload,
  ): Promise<void> {
    await this.send("tax.calculation.failed", payload);
  }

  public async publishTaxCalculationVoided(
    payload: TaxCalculationVoidedEventPayload,
  ): Promise<void> {
    await this.send("tax.calculation.voided", payload);
  }

  public async publishTaxRulesUpdated(
    payload: TaxRulesUpdatedEventPayload,
  ): Promise<void> {
    await this.send("tax.rules.updated", payload);
  }

  public async publishTaxCalculationAdjusted(
    payload: TaxCalculationAdjustedEventPayload,
  ): Promise<void> {
    await this.send("tax.calculation.adjusted", payload);
  }
}

export const taxEventProducer = new TaxEventProducer();
