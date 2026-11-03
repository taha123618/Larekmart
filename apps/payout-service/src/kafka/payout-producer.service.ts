import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createKafkaClient, createProducer } from "@repo/kafka";
import {
  PAYOUT_TOPICS,
  type PayoutScheduledEventPayload,
  type PayoutProcessingEventPayload,
  type PayoutCompletedEventPayload,
  type PayoutFailedEventPayload,
  type PayoutReconciledEventPayload,
} from "@repo/types";
import { env } from "../config/env.js";

@Injectable()
export class PayoutProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutProducerService.name);
  private producer: ReturnType<typeof createProducer> | null = null;
  private connected = false;

  public async onModuleInit(): Promise<void> {
    if (env.NODE_ENV === "test") {
      this.logger.log("Kafka producer in test mode - real broker connection skipped");
      return;
    }

    try {
      const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
      const kafkaClient = createKafkaClient("payout-service-producer", brokers);
      this.producer = createProducer(kafkaClient);
      await this.producer.connect();
      this.connected = true;
      this.logger.log("Connected to Kafka producer");
    } catch (err) {
      this.logger.warn(`Could not connect Kafka producer: ${err}`);
      this.connected = false;
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.connected && this.producer) {
      try {
        await this.producer.disconnect();
      } catch {
        // Disconnect gracefully
      }
    }
  }

  public async emitPayoutScheduled(payload: PayoutScheduledEventPayload): Promise<void> {
    if (!this.connected || !this.producer) {
      this.logger.log(`[Test/Mock] Emitted ${PAYOUT_TOPICS.SCHEDULED} for ${payload.payoutId}`);
      return;
    }
    try {
      await this.producer.send(PAYOUT_TOPICS.SCHEDULED, {
        value: payload,
        options: { key: payload.sellerId },
      });
    } catch (err) {
      this.logger.error(`Failed to publish ${PAYOUT_TOPICS.SCHEDULED}: ${err}`);
    }
  }

  public async emitPayoutProcessing(payload: PayoutProcessingEventPayload): Promise<void> {
    if (!this.connected || !this.producer) return;
    try {
      await this.producer.send(PAYOUT_TOPICS.PROCESSING, {
        value: payload,
        options: { key: payload.sellerId },
      });
    } catch (err) {
      this.logger.error(`Failed to publish ${PAYOUT_TOPICS.PROCESSING}: ${err}`);
    }
  }

  public async emitPayoutCompleted(payload: PayoutCompletedEventPayload): Promise<void> {
    if (!this.connected || !this.producer) {
      this.logger.log(`[Test/Mock] Emitted ${PAYOUT_TOPICS.COMPLETED} for ${payload.payoutId}`);
      return;
    }
    try {
      await this.producer.send(PAYOUT_TOPICS.COMPLETED, {
        value: payload,
        options: { key: payload.sellerId },
      });
    } catch (err) {
      this.logger.error(`Failed to publish ${PAYOUT_TOPICS.COMPLETED}: ${err}`);
    }
  }

  public async emitPayoutFailed(payload: PayoutFailedEventPayload): Promise<void> {
    if (!this.connected || !this.producer) return;
    try {
      await this.producer.send(PAYOUT_TOPICS.FAILED, {
        value: payload,
        options: { key: payload.sellerId },
      });
    } catch (err) {
      this.logger.error(`Failed to publish ${PAYOUT_TOPICS.FAILED}: ${err}`);
    }
  }

  public async emitPayoutReconciled(payload: PayoutReconciledEventPayload): Promise<void> {
    if (!this.connected || !this.producer) return;
    try {
      await this.producer.send(PAYOUT_TOPICS.RECONCILED, {
        value: payload,
        options: { key: payload.batchId },
      });
    } catch (err) {
      this.logger.error(`Failed to publish ${PAYOUT_TOPICS.RECONCILED}: ${err}`);
    }
  }
}
