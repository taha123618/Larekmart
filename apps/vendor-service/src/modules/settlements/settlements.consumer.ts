import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { createKafkaClient, createConsumer } from "@repo/kafka";
import { env } from "../../config/env.js";
import { SettlementsService } from "./settlements.service.js";

@Injectable()
export class SettlementsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementsConsumer.name);
  private consumer: ReturnType<typeof createConsumer> | null = null;
  private isConnected = false;
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(private readonly settlementsService: SettlementsService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === "test" || env.NODE_ENV === "test") {
      this.logger.log(
        "SettlementsConsumer: Kafka and background sweepers skipped in test environment",
      );
      return;
    }

    // Start background sweeper for matured escrows (runs every 10 minutes)
    this.sweepInterval = setInterval(
      async () => {
        try {
          await this.settlementsService.releaseMaturedEscrow();
        } catch (err) {
          this.logger.error("Error in automated escrow maturity sweeper", err);
        }
      },
      10 * 60 * 1000,
    );

    try {
      const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
      const kafka = createKafkaClient("vendor-settlements-consumer", brokers);
      this.consumer = createConsumer(kafka, "vendor-settlements-group");

      await this.consumer.connect();
      await this.consumer.subscribe([
        {
          topicName: "order.created",
          topicHandler: async (message: any) => {
            const payload = message?.value as Record<string, any>;
            if (payload) await this.handleOrderPayment(payload);
          },
        },
        {
          topicName: "payment.successful",
          topicHandler: async (message: any) => {
            const payload = message?.value as Record<string, any>;
            if (payload) await this.handleOrderPayment(payload);
          },
        },
        {
          topicName: "shipment.delivered",
          topicHandler: async (message: any) => {
            const payload = message?.value as Record<string, any>;
            if (payload) await this.handleShipmentDelivered(payload);
          },
        },
        {
          topicName: "return.approved",
          topicHandler: async (message: any) => {
            const payload = message?.value as Record<string, any>;
            if (payload) await this.handleReturnApproved(payload);
          },
        },
      ]);

      this.isConnected = true;
      this.logger.log("SettlementsConsumer subscribed to Kafka topics");
    } catch (err) {
      this.logger.error("Failed to start SettlementsConsumer Kafka loop", err);
    }
  }

  async onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    if (this.consumer && this.isConnected) {
      try {
        await this.consumer.disconnect();
      } catch (err) {
        this.logger.error("Error disconnecting SettlementsConsumer", err);
      }
    }
  }

  async handleEvent(topic: string, payload: Record<string, any>) {
    switch (topic) {
      case "order.created":
      case "payment.successful":
        await this.handleOrderPayment(payload);
        break;

      case "shipment.delivered":
        await this.handleShipmentDelivered(payload);
        break;

      case "return.approved":
        await this.handleReturnApproved(payload);
        break;

      default:
        break;
    }
  }

  private async handleOrderPayment(payload: Record<string, any>) {
    const orderId = payload.orderId || payload.id;
    if (!orderId) return;

    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      const vendorId = item.vendorId;
      if (!vendorId) continue;

      const grossAmount =
        typeof item.price === "number" && typeof item.quantity === "number"
          ? item.price * item.quantity
          : Number(item.price || item.total || 0);

      if (grossAmount <= 0) continue;

      await this.settlementsService.creditOrderEscrow({
        vendorId,
        orderId: String(orderId),
        orderItemId: item.id ? String(item.id) : undefined,
        grossAmount,
        categoryId: item.categoryId ? String(item.categoryId) : undefined,
        currency: payload.currency || "PKR",
      });
    }
  }

  private async handleShipmentDelivered(payload: Record<string, any>) {
    const orderId = payload.orderId;
    if (!orderId) return;

    const deliveredAt = payload.deliveredAt
      ? new Date(payload.deliveredAt)
      : new Date();

    await this.settlementsService.recordDeliveryAndScheduleRelease(
      String(orderId),
      deliveredAt,
    );
  }

  private async handleReturnApproved(payload: Record<string, any>) {
    const orderId = payload.orderId;
    if (!orderId) return;

    await this.settlementsService.reverseEscrowForReturn(
      String(orderId),
      payload.reason || "Customer return approved",
    );
  }
}
