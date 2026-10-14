import { eq, and, sql, desc, lt } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  promotionReservations,
  promotionRedemptions,
  promotionRules,
} from "../db/schema.js";
import { budgetRepository } from "./budget.repository.js";
import { couponRepository } from "./coupon.repository.js";
import type {
  PromotionReservation,
  PromotionRedemption,
  CreateReservationInput,
  Promotion,
  CouponCode,
} from "@repo/types";

export class ReservationRepository {
  /**
   * Find reservation by ID
   */
  async findById(id: string): Promise<PromotionReservation | null> {
    const [res] = await db
      .select()
      .from(promotionReservations)
      .where(eq(promotionReservations.id, id));
    return res ? this.mapReservation(res) : null;
  }

  /**
   * Find reservations by user or guest
   */
  async findActiveByUserOrGuest(userId?: string, guestId?: string): Promise<PromotionReservation[]> {
    if (!userId && !guestId) return [];

    const condition = userId
      ? eq(promotionReservations.userId, userId)
      : eq(promotionReservations.guestId, guestId!);

    const records = await db
      .select()
      .from(promotionReservations)
      .where(
        and(
          condition,
          eq(promotionReservations.status, "RESERVED"),
          sql`${promotionReservations.expiresAt} > NOW()`,
        ),
      )
      .orderBy(desc(promotionReservations.createdAt));

    return records.map((r) => this.mapReservation(r));
  }

  /**
   * Count customer usage: prior redemptions + active unexpired reservations.
   */
  async getCustomerUsageCount(
    promotionId: string,
    userId?: string,
    guestId?: string,
  ): Promise<number> {
    if (!userId && !guestId) return 0;

    let redemptionsCount = 0;
    let activeReservationsCount = 0;

    if (userId) {
      const [rCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(promotionRedemptions)
        .where(
          and(
            eq(promotionRedemptions.promotionId, promotionId),
            eq(promotionRedemptions.userId, userId),
          ),
        );
      redemptionsCount = rCount?.count ?? 0;

      const [resCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(promotionReservations)
        .where(
          and(
            eq(promotionReservations.promotionId, promotionId),
            eq(promotionReservations.userId, userId),
            eq(promotionReservations.status, "RESERVED"),
            sql`${promotionReservations.expiresAt} > NOW()`,
          ),
        );
      activeReservationsCount = resCount?.count ?? 0;
    } else if (guestId) {
      const [resCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(promotionReservations)
        .where(
          and(
            eq(promotionReservations.promotionId, promotionId),
            eq(promotionReservations.guestId, guestId),
            eq(promotionReservations.status, "RESERVED"),
            sql`${promotionReservations.expiresAt} > NOW()`,
          ),
        );
      activeReservationsCount = resCount?.count ?? 0;
    }

    return redemptionsCount + activeReservationsCount;
  }

  /**
   * Atomically create an idempotent reservation.
   */
  async createReservation(
    input: CreateReservationInput,
    promo: Promotion,
    coupon?: CouponCode,
  ): Promise<{ reservation: PromotionReservation; exhausted?: boolean }> {
    return await db.transaction(async (tx) => {
      // 1. Idempotency check: see if already reserved for this order or user/guest
      if (input.orderId) {
        const existing = await tx
          .select()
          .from(promotionReservations)
          .where(
            and(
              eq(promotionReservations.orderId, input.orderId),
              eq(promotionReservations.promotionId, input.promotionId),
              eq(promotionReservations.status, "RESERVED"),
              sql`${promotionReservations.expiresAt} > NOW()`,
            ),
          );

        if (existing.length > 0 && existing[0]) {
          return { reservation: this.mapReservation(existing[0]) };
        }
      }

      // 2. Check per-customer limit
      const maxPerCustomer = promo.rules?.maxPerCustomer ?? 1;
      const currentCustomerUses = await this.getCustomerUsageCount(
        promo.id,
        input.userId,
        input.guestId,
      );
      if (currentCustomerUses >= maxPerCustomer) {
        throw new Error(
          `Customer usage limit of ${maxPerCustomer} exceeded for this promotion`,
        );
      }

      // 3. Check global promotion limit
      const globalLimit = promo.rules?.globalLimit;
      const usageCount = promo.rules?.usageCount ?? 0;
      if (globalLimit != null && usageCount >= globalLimit) {
        throw new Error("Promotion global usage limit reached");
      }

      // 4. Check coupon limit if coupon provided
      if (
        coupon &&
        coupon.maxRedemptions != null &&
        coupon.redemptionsCount >= coupon.maxRedemptions
      ) {
        throw new Error(`Coupon code '${coupon.code}' usage limit reached`);
      }

      // 5. Reserve budget atomically
      const budgetRes = await budgetRepository.reserveBudget(
        promo.id,
        input.discountAmount,
        tx as any,
      );
      if (!budgetRes.success) {
        throw new Error("Promotion campaign budget exhausted");
      }

      // 6. Increment coupon usage count on reservation
      if (coupon) {
        await couponRepository.incrementUsage(coupon.id, tx as any);
      }

      // 7. Insert reservation
      const ttlSeconds = input.ttlSeconds ?? 900;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const [res] = await tx
        .insert(promotionReservations)
        .values({
          promotionId: promo.id,
          couponId: coupon?.id ?? null,
          userId: input.userId,
          guestId: input.guestId,
          orderId: input.orderId,
          discountAmount: input.discountAmount.toFixed(2),
          status: "RESERVED",
          expiresAt,
        })
        .returning();

      if (!res) {
        throw new Error("Failed to create reservation");
      }

      return {
        reservation: this.mapReservation(res),
        exhausted: budgetRes.exhausted,
      };
    });
  }

  /**
   * Commit a reservation upon order placement:
   * - Marks reservation as COMMITTED
   * - Inserts promotion redemption record
   * - Commits budget (reserved -> spent)
   * - Increments promotion rule usageCount
   */
  async commitReservation(
    id: string,
    orderId: string,
  ): Promise<{ redemption: PromotionRedemption; reservation: PromotionReservation; exhausted: boolean }> {
    return await db.transaction(async (tx) => {
      // 1. Lock and retrieve reservation
      const [res] = await tx
        .select()
        .from(promotionReservations)
        .where(eq(promotionReservations.id, id))
        .for("update");

      if (!res) {
        throw new Error(`Reservation '${id}' not found`);
      }

      if (res.status === "COMMITTED") {
        // Idempotent recovery
        const [existingRedemption] = await tx
          .select()
          .from(promotionRedemptions)
          .where(eq(promotionRedemptions.reservationId, id));

        if (existingRedemption) {
          return {
            redemption: this.mapRedemption(existingRedemption),
            reservation: this.mapReservation(res),
            exhausted: false,
          };
        }
      }

      if (res.status !== "RESERVED") {
        throw new Error(`Reservation is in status '${res.status}', cannot commit`);
      }

      const discountAmt = Number(res.discountAmount);

      // 2. Mark reservation committed
      const [updatedRes] = await tx
        .update(promotionReservations)
        .set({
          status: "COMMITTED",
          orderId,
          committedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(promotionReservations.id, id))
        .returning();

      // 3. Increment promotion rule usage count
      await tx
        .update(promotionRules)
        .set({
          usageCount: sql`${promotionRules.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promotionRules.promotionId, res.promotionId));

      // 4. Commit budget
      const budgetRes = await budgetRepository.commitBudget(
        res.promotionId,
        discountAmt,
        tx as any,
      );

      // 5. Insert redemption
      const [redemption] = await tx
        .insert(promotionRedemptions)
        .values({
          promotionId: res.promotionId,
          couponId: res.couponId,
          reservationId: res.id,
          userId: res.userId,
          orderId,
          discountAmount: res.discountAmount,
          redeemedAt: new Date(),
        })
        .returning();

      return {
        redemption: this.mapRedemption(redemption!),
        reservation: this.mapReservation(updatedRes!),
        exhausted: budgetRes.exhausted,
      };
    });
  }

  /**
   * Release a reservation if checkout is cancelled, abandoned, or expired.
   */
  async releaseReservation(id: string): Promise<PromotionReservation | null> {
    return await db.transaction(async (tx) => {
      const [res] = await tx
        .select()
        .from(promotionReservations)
        .where(eq(promotionReservations.id, id))
        .for("update");

      if (!res) return null;
      if (res.status !== "RESERVED") {
        return this.mapReservation(res);
      }

      const discountAmt = Number(res.discountAmount);

      // 1. Mark released
      const [updatedRes] = await tx
        .update(promotionReservations)
        .set({
          status: "RELEASED",
          releasedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(promotionReservations.id, id))
        .returning();

      // 2. Release budget
      await budgetRepository.releaseBudget(res.promotionId, discountAmt, tx as any);

      // 3. Decrement coupon redemptions
      if (res.couponId) {
        await couponRepository.decrementUsage(res.couponId, tx as any);
      }

      return this.mapReservation(updatedRes!);
    });
  }

  /**
   * Periodic or on-demand cleanup of expired reservations.
   */
  async releaseExpiredReservations(): Promise<number> {
    const expiredList = await db
      .select({ id: promotionReservations.id })
      .from(promotionReservations)
      .where(
        and(
          eq(promotionReservations.status, "RESERVED"),
          lt(promotionReservations.expiresAt, new Date()),
        ),
      )
      .limit(100);

    let releasedCount = 0;
    for (const item of expiredList) {
      await this.releaseReservation(item.id);
      releasedCount++;
    }

    return releasedCount;
  }

  private mapReservation(r: typeof promotionReservations.$inferSelect): PromotionReservation {
    return {
      id: r.id,
      promotionId: r.promotionId,
      couponId: r.couponId,
      userId: r.userId,
      guestId: r.guestId,
      orderId: r.orderId,
      discountAmount: Number(r.discountAmount),
      status: r.status as PromotionReservation["status"],
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  }

  private mapRedemption(r: typeof promotionRedemptions.$inferSelect): PromotionRedemption {
    return {
      id: r.id,
      promotionId: r.promotionId,
      couponId: r.couponId,
      reservationId: r.reservationId,
      userId: r.userId,
      orderId: r.orderId,
      discountAmount: Number(r.discountAmount),
      redeemedAt: r.redeemedAt.toISOString(),
    };
  }
}

export const reservationRepository = new ReservationRepository();
