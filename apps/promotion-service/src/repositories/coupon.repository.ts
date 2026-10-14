import { eq, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { couponCodes, promotions } from "../db/schema.js";
import type { CouponCode, CreateCouponInput, Promotion } from "@repo/types";

export interface CouponWithPromotion {
  coupon: CouponCode;
  promotion: Promotion;
}

export class CouponRepository {
  /**
   * Create a new coupon code for a promotion
   */
  async createCoupon(input: CreateCouponInput): Promise<CouponCode> {
    const [coupon] = await db
      .insert(couponCodes)
      .values({
        promotionId: input.promotionId,
        code: input.code.toUpperCase().trim(),
        maxRedemptions: input.maxRedemptions,
        isActive: true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();

    if (!coupon) {
      throw new Error("Failed to create coupon code");
    }

    return this.mapCoupon(coupon);
  }

  /**
   * Find coupon by code string, including associated promotion
   */
  async findByCode(code: string): Promise<CouponWithPromotion | null> {
    const normalized = code.toUpperCase().trim();

    const [row] = await db
      .select({
        coupon: couponCodes,
        promotion: promotions,
      })
      .from(couponCodes)
      .innerJoin(promotions, eq(couponCodes.promotionId, promotions.id))
      .where(eq(couponCodes.code, normalized));

    if (!row) return null;

    return {
      coupon: this.mapCoupon(row.coupon),
      promotion: {
        id: row.promotion.id,
        name: row.promotion.name,
        description: row.promotion.description,
        status: row.promotion.status as Promotion["status"],
        type: row.promotion.type as Promotion["type"],
        discountValue: Number(row.promotion.discountValue),
        maxDiscountAmount: row.promotion.maxDiscountAmount ? Number(row.promotion.maxDiscountAmount) : null,
        startDate: row.promotion.startDate.toISOString(),
        endDate: row.promotion.endDate.toISOString(),
        priority: row.promotion.priority,
        isStackable: row.promotion.isStackable,
        createdAt: row.promotion.createdAt.toISOString(),
        updatedAt: row.promotion.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Find coupon by ID
   */
  async findById(id: string): Promise<CouponCode | null> {
    const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.id, id));
    return coupon ? this.mapCoupon(coupon) : null;
  }

  /**
   * List all coupon codes for a promotion
   */
  async listByPromotionId(promotionId: string): Promise<CouponCode[]> {
    const records = await db
      .select()
      .from(couponCodes)
      .where(eq(couponCodes.promotionId, promotionId));
    return records.map((c) => this.mapCoupon(c));
  }

  /**
   * Atomically increment redemptionsCount by 1
   */
  async incrementUsage(couponId: string, client = db): Promise<void> {
    await client
      .update(couponCodes)
      .set({
        redemptionsCount: sql`${couponCodes.redemptionsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(couponCodes.id, couponId));
  }

  /**
   * Atomically decrement redemptionsCount by 1 (e.g. after release)
   */
  async decrementUsage(couponId: string, client = db): Promise<void> {
    await client
      .update(couponCodes)
      .set({
        redemptionsCount: sql`GREATEST(0, ${couponCodes.redemptionsCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(couponCodes.id, couponId));
  }

  private mapCoupon(c: typeof couponCodes.$inferSelect): CouponCode {
    return {
      id: c.id,
      code: c.code,
      promotionId: c.promotionId,
      maxRedemptions: c.maxRedemptions,
      redemptionsCount: c.redemptionsCount,
      isActive: c.isActive,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}

export const couponRepository = new CouponRepository();
