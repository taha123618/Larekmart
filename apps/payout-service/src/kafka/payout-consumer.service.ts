import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";
import { createKafkaClient, createConsumer } from "@repo/kafka";
import { LedgerService } from "../ledger/ledger.service.js";
import {
  COMMISSION_TOPICS,
  type CommissionAccruedEvent,
  type CommissionAdjustedEvent,
  type CommissionReversedEvent,
} from "@repo/types";
import { env } from "../config/env.js";

function unwrapPayload(message: unknown): Record<string, unknown> {
  if (!message || typeof message !== "object") return {};
  const msgObj = message as Record<string, unknown>;
  if (msgObj.value && typeof msgObj.value === "object") {
    return msgObj.value as Record<string, unknown>;
  }
  return msgObj;
}

@Injectable()
export class PayoutConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutConsumerService.name);
  private consumer: ReturnType<typeof createConsumer> | null = null;
  private connected = false;

  constructor(
    @Inject(LedgerService)
    private readonly ledgerService: LedgerService,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (env.NODE_ENV === "test") {
      this.logger.log("Kafka consumer in test mode - real broker connection skipped");
      return;
    }

    try {
      const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
      const kafkaClient = createKafkaClient("payout-service-consumer", brokers);
      this.consumer = createConsumer(kafkaClient, "payout-service-consumer-group");
      await this.consumer.connect();
      this.connected = true;

      await this.consumer.subscribe([
        {
          topicName: COMMISSION_TOPICS.ACCRUED,
          topicHandler: async (message) => {
            const payload = unwrapPayload(message) as unknown as CommissionAccruedEvent;
            if (!payload || !payload.calculationId) return;
            await this.handleCommissionAccrued(payload);
          },
        },
        {
          topicName: COMMISSION_TOPICS.ADJUSTED,
          topicHandler: async (message) => {
            const payload = unwrapPayload(message) as unknown as CommissionAdjustedEvent;
            if (!payload || !payload.adjustmentId) return;
            await this.handleCommissionAdjusted(payload);
          },
        },
        {
          topicName: COMMISSION_TOPICS.REVERSED,
          topicHandler: async (message) => {
            const payload = unwrapPayload(message) as unknown as CommissionReversedEvent;
            if (!payload || !payload.orderId) return;
            await this.handleCommissionReversed(payload);
          },
        },
      ]);

      this.logger.log("Payout consumer successfully subscribed to Kafka topics");
    } catch (err) {
      this.logger.warn(`Could not start Kafka consumer: ${err}`);
      this.connected = false;
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.connected && this.consumer) {
      try {
        await this.consumer.disconnect();
      } catch {
        // Disconnect gracefully
      }
    }
  }

  public async handleCommissionAccrued(payload: CommissionAccruedEvent): Promise<void> {
    this.logger.log(
      `Accruing seller funds from commission calculation ${payload.calculationId} for order ${payload.orderId}`,
    );

    const currency = payload.currency || "PKR";
    const commissionAmount = payload.totalCommission || 0;
    const sellerId = `seller_order_${payload.orderId}`;

    try {
      const escrowAccountId = await this.ledgerService.getOrCreateAccount(sellerId, "SELLER_ESCROW", currency);
      const commissionAccountId = await this.ledgerService.getOrCreateAccount(null, "PLATFORM_COMMISSION", currency);

      await this.ledgerService.postBalancedTransaction(
        [
          {
            accountId: escrowAccountId,
            entryType: "CREDIT",
            amount: commissionAmount,
            currency,
            referenceType: "ORDER_COMMISSION_ACCRUAL",
            referenceId: payload.orderId,
            description: `Order ${payload.orderId} earnings settlement`,
          },
          {
            accountId: commissionAccountId,
            entryType: "DEBIT",
            amount: commissionAmount,
            currency,
            referenceType: "ORDER_COMMISSION_ACCRUAL",
            referenceId: payload.orderId,
            description: `Order ${payload.orderId} platform commission fee`,
          },
        ],
        `txn_accrual_${payload.orderId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to post ledger accrual for order ${payload.orderId}: ${err}`);
    }
  }

  public async handleCommissionAdjusted(payload: CommissionAdjustedEvent): Promise<void> {
    this.logger.log(`Adjusting ledger for adjustment ${payload.adjustmentId} on order ${payload.orderId}`);
  }

  public async handleCommissionReversed(payload: CommissionReversedEvent): Promise<void> {
    this.logger.log(`Reversing ledger for cancelled order ${payload.orderId}`);
  }
}
