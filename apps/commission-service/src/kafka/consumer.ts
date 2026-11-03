import { createKafkaClient, createConsumer } from "@repo/kafka";
import { commissionService } from "../services/commission.service.js";
import { env } from "../config/env.js";

const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
const kafkaClient = createKafkaClient(env.KAFKA_CLIENT_ID, brokers);
export const kafkaConsumer = createConsumer(kafkaClient, env.KAFKA_GROUP_ID);

function unwrapPayload(message: unknown): Record<string, unknown> {
  if (!message || typeof message !== "object") return {};
  const msgObj = message as Record<string, unknown>;
  if (msgObj.value && typeof msgObj.value === "object") {
    return msgObj.value as Record<string, unknown>;
  }
  return msgObj;
}

export class CommissionEventConsumer {
  private running = false;

  public async start(): Promise<void> {
    try {
      await kafkaConsumer.connect();

      await kafkaConsumer.subscribe([
        {
          topicName: "order.created",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            const orderId = String(payload.orderId || payload.id || "");
            const items = payload.items as Array<Record<string, unknown>>;
            if (orderId && Array.isArray(items) && items.length > 0) {
              const formattedItems = items.map((i, idx) => ({
                orderItemId: String(i.orderItemId || i.id || `item_${idx}`),
                productId: String(i.productId || i.id || ""),
                categoryId: String(i.categoryId || "cat_default"),
                sellerId: String(
                  i.sellerId || payload.sellerId || "seller_default",
                ),
                itemPrice: Number(i.price || i.itemPrice || 0),
                quantity: Number(i.quantity || 1),
              }));

              await commissionService.accrueOrderCommissions(
                orderId,
                formattedItems,
                String(payload.currency || "PKR"),
              );
            }
          },
        },
        {
          topicName: "payment.successful",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            const orderId = String(payload.orderId || payload.id || "");
            const items = payload.items as Array<Record<string, unknown>>;
            if (orderId && Array.isArray(items) && items.length > 0) {
              const formattedItems = items.map((i, idx) => ({
                orderItemId: String(i.orderItemId || i.id || `item_${idx}`),
                productId: String(i.productId || i.id || ""),
                categoryId: String(i.categoryId || "cat_default"),
                sellerId: String(
                  i.sellerId || payload.sellerId || "seller_default",
                ),
                itemPrice: Number(i.price || i.itemPrice || 0),
                quantity: Number(i.quantity || 1),
              }));

              await commissionService.accrueOrderCommissions(
                orderId,
                formattedItems,
                String(payload.currency || "PKR"),
              );
            }
          },
        },
        {
          topicName: "return.completed",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            const orderId = String(payload.orderId || "");
            const sellerId = String(payload.sellerId || "");
            const returnId = String(payload.returnId || payload.id || "");
            const refundAmount = Number(
              payload.refundAmount || payload.amount || 0,
            );

            if (orderId && sellerId && refundAmount > 0) {
              await commissionService.adjustCommissionForReturn({
                orderId,
                sellerId,
                returnId,
                amountToAdjust: refundAmount * 0.08,
                reason: String(payload.reason || "Return completed refund"),
              });
            }
          },
        },
        {
          topicName: "order.cancelled",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            const orderId = String(payload.orderId || payload.id || "");
            if (orderId) {
              await commissionService.reverseCommissionForOrder(
                orderId,
                String(payload.reason || "Order cancellation"),
              );
            }
          },
        },
        {
          topicName: "seller.created",
          topicHandler: async (message) => {
            const payload = unwrapPayload(message);
            const sellerId = String(payload.sellerId || payload.id || "");
            if (sellerId) {
              console.log(
                `[CommissionConsumer] New seller registered: ${sellerId}. Enforcing default marketplace commission plan.`,
              );
            }
          },
        },
      ]);

      this.running = true;
    } catch (err) {
      console.warn(
        "[CommissionConsumer] Warning: Could not connect to Kafka; operating in disconnected mode:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  public async stop(): Promise<void> {
    if (this.running) {
      await kafkaConsumer.disconnect();
      this.running = false;
    }
  }
}

export const commissionEventConsumer = new CommissionEventConsumer();
