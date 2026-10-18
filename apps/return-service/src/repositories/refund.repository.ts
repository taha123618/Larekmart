import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { returnRefunds } from "../db/schema.js";

export interface CreateRefundData {
  returnId: string;
  paymentIntentId: string;
  idempotencyKey: string;
  amount: string;
  taxAmount: string;
  shippingDeduction: string;
  currency: string;
}

export class RefundRepository {
  private db = getDb();

  async createRefundRequest(data: CreateRefundData): Promise<string> {
    const id = uuidv4();
    await this.db.insert(returnRefunds).values({
      id,
      returnId: data.returnId,
      paymentIntentId: data.paymentIntentId,
      idempotencyKey: data.idempotencyKey,
      amount: data.amount,
      taxAmount: data.taxAmount,
      shippingDeduction: data.shippingDeduction,
      currency: data.currency,
      status: "REQUESTED",
    });
    return id;
  }

  async findByReturnId(returnId: string) {
    return this.db
      .select()
      .from(returnRefunds)
      .where(eq(returnRefunds.returnId, returnId));
  }

  async findByIdempotencyKey(key: string) {
    const rows = await this.db
      .select()
      .from(returnRefunds)
      .where(eq(returnRefunds.idempotencyKey, key))
      .limit(1);
    return rows[0] || null;
  }

  async markCompleted(returnId: string, stripeRefundId?: string) {
    await this.db
      .update(returnRefunds)
      .set({
        status: "COMPLETED",
        stripeRefundId: stripeRefundId || null,
        completedAt: new Date(),
      })
      .where(eq(returnRefunds.returnId, returnId));
  }

  async markFailed(returnId: string, failureReason: string) {
    await this.db
      .update(returnRefunds)
      .set({
        status: "FAILED",
        failureReason,
      })
      .where(eq(returnRefunds.returnId, returnId));
  }
}

export const refundRepository = new RefundRepository();
