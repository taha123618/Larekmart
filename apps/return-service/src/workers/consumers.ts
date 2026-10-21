/**
 * Kafka consumers for the return-service.
 *
 * Subscribed topics (consumed from other services):
 *  - order.delivered          → unlock the return window eligibility check
 *  - payment.refund.succeeded → mark the return as REFUNDED
 *  - payment.refund.failed    → mark the return as REFUND_FAILED
 *  - shipping.label.created   → record the prepaid return-shipment label
 *
 * A bad message is caught and logged — it never crashes the consumer loop.
 */
import { createKafkaClient, createConsumer } from "@repo/kafka";
import { env } from "../config/env.js";
import { returnRepository } from "../repositories/return.repository.js";
import { shipmentRepository } from "../repositories/shipment.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { ReturnStatusEnum } from "@repo/types";

// ─── Handler: order.delivered ────────────────────────────────────────────────
async function handleOrderDelivered(message: {
  orderId: string;
  deliveredAt?: string;
}): Promise<void> {
  // This is a signal — we store nothing but log for observability.
  // Actual eligibility check happens at request time from DB order state.
  console.log(
    `[return-service:consumer] order.delivered received for order ${message.orderId}`,
  );
}

// ─── Handler: payment.refund.succeeded ───────────────────────────────────────
async function handleRefundSucceeded(message: {
  returnId?: string;
  orderId?: string;
  paymentIntentId: string;
  amount: string;
  currency: string;
  refundedAt: string;
}): Promise<void> {
  if (!message.returnId) {
    console.warn(
      "[return-service:consumer] payment.refund.succeeded missing returnId — skipping",
    );
    return;
  }
  const ret = await returnRepository.findById(message.returnId);
  if (!ret) {
    console.warn(
      `[return-service:consumer] payment.refund.succeeded: return ${message.returnId} not found`,
    );
    return;
  }

  await returnRepository.updateStatus(
    message.returnId,
    ret.status,
    ReturnStatusEnum.COMPLETED,
    "SYSTEM_PAYMENT",
    "SYSTEM",
    `Stripe refund confirmed: ${message.paymentIntentId} — ${message.amount} ${message.currency}`,
  );

  await outboxRepository.insertMessage("return.completed", message.returnId, {
    returnId: message.returnId,
    orderId: ret.orderId,
    customerId: ret.customerId,
    paymentIntentId: message.paymentIntentId,
    amount: message.amount,
    currency: message.currency,
    refundedAt: message.refundedAt,
  });

  console.log(
    `[return-service:consumer] Return ${message.returnId} marked REFUNDED (PI: ${message.paymentIntentId})`,
  );
}

// ─── Handler: payment.refund.failed ──────────────────────────────────────────
async function handleRefundFailed(message: {
  returnId?: string;
  orderId?: string;
  paymentIntentId: string;
  failureReason?: string;
  failedAt: string;
}): Promise<void> {
  if (!message.returnId) {
    console.warn(
      "[return-service:consumer] payment.refund.failed missing returnId — skipping",
    );
    return;
  }
  const ret = await returnRepository.findById(message.returnId);
  if (!ret) return;

  await returnRepository.updateStatus(
    message.returnId,
    ret.status,
    ReturnStatusEnum.REFUND_FAILED,
    "SYSTEM_PAYMENT",
    "SYSTEM",
    `Stripe refund failed: ${message.failureReason || "unknown reason"}`,
  );

  console.error(
    `[return-service:consumer] Return ${message.returnId} refund FAILED:`,
    message.failureReason,
  );
}

// ─── Handler: shipping.label.created ─────────────────────────────────────────
async function handleShippingLabelCreated(message: {
  returnId?: string;
  shipmentId?: string;
  trackingNumber?: string;
  carrierName?: string;
  labelUrl?: string;
  createdAt?: string;
}): Promise<void> {
  if (!message.returnId || !message.trackingNumber || !message.carrierName) {
    console.warn(
      "[return-service:consumer] shipping.label.created missing fields — skipping",
    );
    return;
  }

  const ret = await returnRepository.findById(message.returnId);
  if (!ret) {
    console.warn(
      `[return-service:consumer] shipping.label.created: return ${message.returnId} not found`,
    );
    return;
  }

  // Upsert the prepaid shipment record
  await shipmentRepository.createShipment({
    returnId: message.returnId,
    carrierName: message.carrierName,
    trackingNumber: message.trackingNumber,
    isPrepaid: true,
    paidBy: "SELLER",
    shippingFee: "0.00",
    labelUrl: message.labelUrl,
    trackingStatus: "LABEL_CREATED",
  });

  await returnRepository.updateStatus(
    message.returnId,
    ret.status,
    ReturnStatusEnum.AWAITING_RETURN_SHIPMENT,
    "SYSTEM_SHIPPING",
    "SYSTEM",
    `Prepaid label created via shipping-service: ${message.trackingNumber}`,
  );

  console.log(
    `[return-service:consumer] Prepaid label recorded for return ${message.returnId}: ${message.trackingNumber}`,
  );
}

// ─── Consumer registration ────────────────────────────────────────────────────
export async function startConsumers(): Promise<() => Promise<void>> {
  const kafka = createKafkaClient(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS);
  const consumer = createConsumer(kafka, env.KAFKA_GROUP_ID);

  await consumer.connect();

  await consumer.subscribe([
    {
      topicName: "order.delivered",
      topicHandler: async (msg: unknown) => {
        await handleOrderDelivered(
          msg as Parameters<typeof handleOrderDelivered>[0],
        );
      },
    },
    {
      topicName: "payment.refund.succeeded",
      topicHandler: async (msg: unknown) => {
        await handleRefundSucceeded(
          msg as Parameters<typeof handleRefundSucceeded>[0],
        );
      },
    },
    {
      topicName: "payment.refund.failed",
      topicHandler: async (msg: unknown) => {
        await handleRefundFailed(
          msg as Parameters<typeof handleRefundFailed>[0],
        );
      },
    },
    {
      topicName: "shipping.label.created",
      topicHandler: async (msg: unknown) => {
        await handleShippingLabelCreated(
          msg as Parameters<typeof handleShippingLabelCreated>[0],
        );
      },
    },
  ]);

  console.log("[return-service:consumer] Subscribed to Kafka topics.");

  return async () => {
    await consumer.disconnect();
    console.log("[return-service:consumer] Consumer disconnected.");
  };
}
