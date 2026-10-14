import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { purchaseEligibility } from "../db/schema.js";

export interface CreateEligibilityInput {
  userId: string;
  productId: string;
  orderId: string;
  orderItemId: string;
  deliveredAt: Date;
}

export class EligibilityRepository {
  async createEligibility(input: CreateEligibilityInput) {
    const existing = await this.findByUserAndProduct(
      input.userId,
      input.productId,
    );
    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(purchaseEligibility)
      .values({
        userId: input.userId,
        productId: input.productId,
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        deliveredAt: input.deliveredAt,
        hasReviewed: false,
      })
      .returning();

    return created;
  }

  async findByUserAndProduct(userId: string, productId: string) {
    const [record] = await db
      .select()
      .from(purchaseEligibility)
      .where(
        and(
          eq(purchaseEligibility.userId, userId),
          eq(purchaseEligibility.productId, productId),
        ),
      )
      .limit(1);

    return record || null;
  }

  async markAsReviewed(userId: string, productId: string) {
    const [updated] = await db
      .update(purchaseEligibility)
      .set({ hasReviewed: true })
      .where(
        and(
          eq(purchaseEligibility.userId, userId),
          eq(purchaseEligibility.productId, productId),
        ),
      )
      .returning();

    return updated || null;
  }
}

export const eligibilityRepository = new EligibilityRepository();
