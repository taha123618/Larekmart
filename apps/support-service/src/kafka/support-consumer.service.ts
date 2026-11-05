import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { createKafkaClient, createConsumer } from "@repo/kafka";
import { TicketsService } from "../modules/tickets/tickets.service.js";
import { env } from "../config/env.js";

function unwrapPayload(message: unknown): Record<string, unknown> {
  if (!message || typeof message !== "object") return {};
  const msgObj = message as Record<string, unknown>;
  if (msgObj.value && typeof msgObj.value === "object") {
    return msgObj.value as Record<string, unknown>;
  }
  return msgObj;
}

const SYSTEM_ACTOR = {
  userId: "system",
  role: "admin",
  email: "system@larekmart.internal",
  isSeller: false,
};

@Injectable()
export class SupportConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportConsumerService.name);
  private consumer: ReturnType<typeof createConsumer> | null = null;
  private isConnected = false;

  constructor(
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (env.NODE_ENV === "test") {
      this.logger.log(
        "Support Kafka consumer in test mode - real broker connection skipped",
      );
      return;
    }

    try {
      const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
      const kafka = createKafkaClient("support-service-consumer", brokers);
      this.consumer = createConsumer(kafka, "support-service-consumer-group");
      await this.consumer.connect();
      this.isConnected = true;

      await this.consumer.subscribe([
        {
          topicName: "return.rejected",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            await this.handleReturnRejected(payload);
          },
        },
        {
          topicName: "dispute.created",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            await this.handleDisputeCreated(payload);
          },
        },
        {
          topicName: "fraud.case.escalated",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            await this.handleFraudCaseEscalated(payload);
          },
        },
        {
          topicName: "chat.message.reported",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            await this.handleChatMessageReported(payload);
          },
        },
      ]);

      this.logger.log(
        "Support Kafka consumer subscribed to cross-service topics",
      );
    } catch (err) {
      this.logger.error("Failed to initialize Support Kafka consumer", err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer && this.isConnected) {
      try {
        await this.consumer.disconnect();
        this.logger.log("Support Kafka consumer disconnected");
      } catch (err) {
        this.logger.error("Error disconnecting Support Kafka consumer", err);
      }
    }
  }

  private async handleReturnRejected(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const returnId = String(payload.returnId || payload.id || "");
    const orderId = String(payload.orderId || "");
    const customerId = String(payload.customerId || payload.userId || "");
    const reason = String(
      payload.rejectionReason ||
        payload.reason ||
        "Return request rejected by seller or inspector",
    );

    if (!returnId && !orderId) return;

    this.logger.log(`Processing return.rejected event for return ${returnId}`);
    try {
      await this.ticketsService.createTicket(
        {
          subject: `Review for Rejected Return #${returnId.slice(0, 8)}`,
          description: `An automated support case has been opened following rejection of RMA #${returnId} on order #${orderId}. Rejection Reason: ${reason}. A support agent will review for platform arbitration.`,
          categoryCode: "RETURN_REFUND",
          priority: "HIGH",
          source: "SYSTEM",
          customerId: customerId || undefined,
          orderId: orderId || undefined,
          returnId: returnId || undefined,
        },
        SYSTEM_ACTOR,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-create ticket for return.rejected ${returnId}`,
        err,
      );
    }
  }

  private async handleDisputeCreated(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const disputeId = String(payload.disputeId || payload.id || "");
    const orderId = String(payload.orderId || "");
    const sellerId = String(payload.sellerId || payload.vendorId || "");
    const customerId = String(payload.customerId || payload.userId || "");
    const claim = String(
      payload.claim || payload.reason || "Dispute initiated",
    );

    if (!orderId && !disputeId) return;

    this.logger.log(
      `Processing dispute.created event for dispute ${disputeId}`,
    );
    try {
      await this.ticketsService.createTicket(
        {
          subject: `Dispute Case Arbitration: Order #${orderId}`,
          description: `Formal customer dispute opened (Dispute ID: ${disputeId}). Claim details: ${claim}.`,
          categoryCode: "SELLER_DISPUTE",
          priority: "HIGH",
          source: "SYSTEM",
          customerId: customerId || undefined,
          sellerId: sellerId || undefined,
          orderId: orderId || undefined,
        },
        SYSTEM_ACTOR,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-create ticket for dispute.created ${disputeId}`,
        err,
      );
    }
  }

  private async handleFraudCaseEscalated(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const caseId = String(payload.caseId || payload.id || "");
    const userId = String(payload.userId || payload.customerId || "");
    const riskScore = Number(payload.riskScore || 0);
    const reason = String(
      payload.reason || "High risk transaction velocity detected",
    );

    this.logger.log(`Processing fraud.case.escalated event for case ${caseId}`);
    try {
      await this.ticketsService.createTicket(
        {
          subject: `Security Alert: High Risk Case #${caseId.slice(0, 8)}`,
          description: `Critical security case escalated by fraud detection engine (Risk Score: ${riskScore.toFixed(2)}). Anomaly Reason: ${reason}. Verification hold placed on account.`,
          categoryCode: "ACCOUNT_SECURITY",
          priority: "CRITICAL",
          source: "SYSTEM",
          customerId: userId || undefined,
        },
        SYSTEM_ACTOR,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-create ticket for fraud.case.escalated ${caseId}`,
        err,
      );
    }
  }

  private async handleChatMessageReported(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const messageId = String(payload.messageId || "");
    const conversationId = String(payload.conversationId || "");
    const reportedByUserId = String(payload.reportedByUserId || "");
    const reason = String(payload.reason || "Abusive behavior or harassment");
    const details = String(payload.details || "");

    if (!messageId && !conversationId) return;

    this.logger.log(`Processing chat.message.reported event for message ${messageId}`);
    try {
      await this.ticketsService.createTicket(
        {
          subject: `Chat Abuse Report: Message #${messageId.slice(0, 8)}`,
          description: `A participant reported abusive content in conversation #${conversationId}.\nReported By: ${reportedByUserId}\nReason: ${reason}\nDetails: ${details}\n\nPlease inspect the chat transcript and take moderation or disciplinary action if necessary.`,
          categoryCode: "OTHER",
          priority: "HIGH",
          source: "SYSTEM",
          customerId: reportedByUserId || undefined,
        },
        SYSTEM_ACTOR,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-create ticket for chat.message.reported ${messageId}`,
        err,
      );
    }
  }
}
