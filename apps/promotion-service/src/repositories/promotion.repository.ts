import { eq, and, lte, gte, or, isNull, sql, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  promotions,
  promotionRules,
  promotionTargets,
  couponCodes,
  promotionBudgets,
  promotionAuditLogs,
  promotionRedemptions,
  promotionReservations,
} from "../db/schema.js";
import type {
  Promotion,
  PromotionRule,
  PromotionTarget,
  PromotionBudget,
  CouponCode,
  PromotionAuditLog,
  PromotionRedemption,
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionOverviewResponse,
} from "@repo/types";

export class PromotionRepository {
  /**
   * Create a promotion along with its rules, targets, optional budget, and audit log.
   */
  async create(
    input: CreatePromotionInput,
    actorId = "system",
  ): Promise<Promotion> {
    return await db.transaction(async (tx) => {
      // 1. Insert promotion
      const [promo] = await tx
        .insert(promotions)
        .values({
          name: input.name,
          description: input.description,
          type: input.type,
          discountValue: input.discountValue.toFixed(2),
          maxDiscountAmount:
            input.maxDiscountAmount != null
              ? input.maxDiscountAmount.toFixed(2)
              : null,
          status: "DRAFT",
          priority: input.priority ?? 0,
          isStackable: input.isStackable ?? false,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        })
        .returning();

      if (!promo) {
        throw new Error("Failed to insert promotion");
      }

      // 2. Insert rule if provided
      let ruleRecord: PromotionRule | undefined;
      if (input.rules) {
        const [r] = await tx
          .insert(promotionRules)
          .values({
            promotionId: promo.id,
            minOrderAmount:
              input.rules.minOrderAmount != null
                ? input.rules.minOrderAmount.toFixed(2)
                : "0.00",
            customerSegment: input.rules.customerSegment ?? "ALL",
            maxPerCustomer: input.rules.maxPerCustomer ?? 1,
            globalLimit: input.rules.globalLimit,
            usageCount: 0,
          })
          .returning();
        if (r) {
          ruleRecord = this.mapRule(r);
        }
      }

      // 3. Insert targets if provided
      const targetRecords: PromotionTarget[] = [];
      if (input.targets && input.targets.length > 0) {
        const insertedTargets = await tx
          .insert(promotionTargets)
          .values(
            input.targets.map((t) => ({
              promotionId: promo.id,
              targetType: t.targetType,
              targetId: t.targetId,
              ruleType: t.ruleType ?? "INCLUDE",
            })),
          )
          .returning();
        targetRecords.push(...insertedTargets.map((t) => this.mapTarget(t)));
      }

      // 4. Insert budget if provided
      let budgetRecord: PromotionBudget | undefined;
      if (input.budget && input.budget.totalBudget > 0) {
        const [b] = await tx
          .insert(promotionBudgets)
          .values({
            promotionId: promo.id,
            totalBudget: input.budget.totalBudget.toFixed(2),
            spentAmount: "0.00",
            reservedAmount: "0.00",
            currency: input.budget.currency ?? "USD",
          })
          .returning();
        if (b) {
          budgetRecord = this.mapBudget(b);
        }
      }

      // 5. Insert audit log
      await tx.insert(promotionAuditLogs).values({
        entityType: "PROMOTION",
        entityId: promo.id,
        action: "PROMOTION_CREATED",
        performedBy: actorId,
        metadata: { input },
      });

      return {
        ...this.mapPromotion(promo),
        rules: ruleRecord,
        targets: targetRecords,
        budget: budgetRecord,
        coupons: [],
      };
    });
  }

  /**
   * Find a promotion by ID with its details.
   */
  async findById(id: string): Promise<Promotion | null> {
    const [promo] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id));
    if (!promo) return null;

    const [rule] = await db
      .select()
      .from(promotionRules)
      .where(eq(promotionRules.promotionId, id));

    const targets = await db
      .select()
      .from(promotionTargets)
      .where(eq(promotionTargets.promotionId, id));

    const coupons = await db
      .select()
      .from(couponCodes)
      .where(eq(couponCodes.promotionId, id));

    const [budget] = await db
      .select()
      .from(promotionBudgets)
      .where(eq(promotionBudgets.promotionId, id));

    return {
      ...this.mapPromotion(promo),
      rules: rule ? this.mapRule(rule) : undefined,
      targets: targets.map((t) => this.mapTarget(t)),
      coupons: coupons.map((c) => this.mapCoupon(c)),
      budget: budget ? this.mapBudget(budget) : null,
    };
  }

  /**
   * Find active promotions eligible right now.
   */
  async findActive(): Promise<Promotion[]> {
    const now = new Date();

    const activePromos = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.status, "ACTIVE"),
          lte(promotions.startDate, now),
          gte(promotions.endDate, now),
        ),
      )
      .orderBy(desc(promotions.priority));

    if (activePromos.length === 0) return [];

    const promoIds = activePromos.map((p) => p.id);

    // Fetch associated rules, targets, budgets, coupons
    const allRules = await db
      .select()
      .from(promotionRules)
      .where(sql`${promotionRules.promotionId} IN ${promoIds}`);

    const allTargets = await db
      .select()
      .from(promotionTargets)
      .where(sql`${promotionTargets.promotionId} IN ${promoIds}`);

    const allCoupons = await db
      .select()
      .from(couponCodes)
      .where(sql`${couponCodes.promotionId} IN ${promoIds}`);

    const allBudgets = await db
      .select()
      .from(promotionBudgets)
      .where(sql`${promotionBudgets.promotionId} IN ${promoIds}`);

    return activePromos
      .filter((p) => {
        const rule = allRules.find((r) => r.promotionId === p.id);
        if (
          rule &&
          rule.globalLimit != null &&
          rule.usageCount >= rule.globalLimit
        ) {
          return false;
        }
        return true;
      })
      .map((p) => ({
        ...this.mapPromotion(p),
        rules: allRules.find((r) => r.promotionId === p.id)
          ? this.mapRule(allRules.find((r) => r.promotionId === p.id)!)
          : undefined,
        targets: allTargets
          .filter((t) => t.promotionId === p.id)
          .map((t) => this.mapTarget(t)),
        coupons: allCoupons
          .filter((c) => c.promotionId === p.id)
          .map((c) => this.mapCoupon(c)),
        budget: allBudgets.find((b) => b.promotionId === p.id)
          ? this.mapBudget(allBudgets.find((b) => b.promotionId === p.id)!)
          : null,
      }));
  }

  /**
   * Find promotions with pagination, search, status, and type filtering for admin.
   */
  async findWithFilters(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }): Promise<{
    items: Promotion[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.status && params.status !== "ALL") {
      conditions.push(eq(promotions.status, params.status));
    }
    if (params.type && params.type !== "ALL") {
      conditions.push(eq(promotions.type, params.type));
    }
    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        or(
          sql`${promotions.name} ILIKE ${term}`,
          sql`${promotions.description} ILIKE ${term}`,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promotions)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const promoRows = await db
      .select()
      .from(promotions)
      .where(whereClause)
      .orderBy(desc(promotions.createdAt))
      .limit(limit)
      .offset(offset);

    if (promoRows.length === 0) {
      return { items: [], total, page, limit, totalPages };
    }

    const promoIds = promoRows.map((p) => p.id);

    const [allRules, allTargets, allCoupons, allBudgets] = await Promise.all([
      db
        .select()
        .from(promotionRules)
        .where(sql`${promotionRules.promotionId} IN ${promoIds}`),
      db
        .select()
        .from(promotionTargets)
        .where(sql`${promotionTargets.promotionId} IN ${promoIds}`),
      db
        .select()
        .from(couponCodes)
        .where(sql`${couponCodes.promotionId} IN ${promoIds}`),
      db
        .select()
        .from(promotionBudgets)
        .where(sql`${promotionBudgets.promotionId} IN ${promoIds}`),
    ]);

    const items: Promotion[] = promoRows.map((p) => ({
      ...this.mapPromotion(p),
      rules: allRules.find((r) => r.promotionId === p.id)
        ? this.mapRule(allRules.find((r) => r.promotionId === p.id)!)
        : undefined,
      targets: allTargets
        .filter((t) => t.promotionId === p.id)
        .map((t) => this.mapTarget(t)),
      coupons: allCoupons
        .filter((c) => c.promotionId === p.id)
        .map((c) => this.mapCoupon(c)),
      budget: allBudgets.find((b) => b.promotionId === p.id)
        ? this.mapBudget(allBudgets.find((b) => b.promotionId === p.id)!)
        : null,
    }));

    return { items, total, page, limit, totalPages };
  }

  /**
   * Update promotion properties, rules, and log changes.
   */
  async update(
    id: string,
    input: UpdatePromotionInput,
    actorId = "system",
  ): Promise<Promotion | null> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(promotions)
        .where(eq(promotions.id, id));
      if (!existing) return null;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.discountValue !== undefined)
        updateData.discountValue = input.discountValue.toFixed(2);
      if (input.maxDiscountAmount !== undefined)
        updateData.maxDiscountAmount =
          input.maxDiscountAmount != null
            ? input.maxDiscountAmount.toFixed(2)
            : null;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.isStackable !== undefined)
        updateData.isStackable = input.isStackable;
      if (input.startDate !== undefined)
        updateData.startDate = new Date(input.startDate);
      if (input.endDate !== undefined)
        updateData.endDate = new Date(input.endDate);

      await tx.update(promotions).set(updateData).where(eq(promotions.id, id));

      // Update rules if provided
      if (input.rules) {
        const [existingRule] = await tx
          .select()
          .from(promotionRules)
          .where(eq(promotionRules.promotionId, id));

        const ruleData: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (input.rules.minOrderAmount !== undefined)
          ruleData.minOrderAmount =
            input.rules.minOrderAmount != null
              ? input.rules.minOrderAmount.toFixed(2)
              : "0.00";
        if (input.rules.customerSegment !== undefined)
          ruleData.customerSegment = input.rules.customerSegment;
        if (input.rules.maxPerCustomer !== undefined)
          ruleData.maxPerCustomer = input.rules.maxPerCustomer;
        if (input.rules.globalLimit !== undefined)
          ruleData.globalLimit = input.rules.globalLimit;

        if (existingRule) {
          await tx
            .update(promotionRules)
            .set(ruleData)
            .where(eq(promotionRules.id, existingRule.id));
        } else {
          await tx.insert(promotionRules).values({
            promotionId: id,
            minOrderAmount:
              input.rules.minOrderAmount != null
                ? input.rules.minOrderAmount.toFixed(2)
                : "0.00",
            customerSegment: input.rules.customerSegment ?? "ALL",
            maxPerCustomer: input.rules.maxPerCustomer ?? 1,
            globalLimit: input.rules.globalLimit,
            usageCount: 0,
          });
        }
      }

      // Update budget if provided
      if (input.budget) {
        const [existingBudget] = await tx
          .select()
          .from(promotionBudgets)
          .where(eq(promotionBudgets.promotionId, id));

        if (existingBudget) {
          await tx
            .update(promotionBudgets)
            .set({
              totalBudget: input.budget.totalBudget.toFixed(2),
              currency: input.budget.currency ?? "USD",
              updatedAt: new Date(),
            })
            .where(eq(promotionBudgets.id, existingBudget.id));
        } else {
          await tx.insert(promotionBudgets).values({
            promotionId: id,
            totalBudget: input.budget.totalBudget.toFixed(2),
            spentAmount: "0.00",
            reservedAmount: "0.00",
            currency: input.budget.currency ?? "USD",
          });
        }
      }

      // Audit log
      await tx.insert(promotionAuditLogs).values({
        entityType: "PROMOTION",
        entityId: id,
        action: "PROMOTION_UPDATED",
        performedBy: actorId,
        metadata: { input },
      });

      return await this.findById(id);
    });
  }

  /**
   * Activate promotion
   */
  async activate(id: string, actorId = "system"): Promise<Promotion | null> {
    const [updated] = await db
      .update(promotions)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(promotions.id, id))
      .returning();

    if (!updated) return null;

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: id,
      action: "PROMOTION_ACTIVATED",
      performedBy: actorId,
      metadata: { status: "ACTIVE" },
    });

    return await this.findById(id);
  }

  /**
   * Deactivate promotion
   */
  async deactivate(id: string, actorId = "system"): Promise<Promotion | null> {
    const [updated] = await db
      .update(promotions)
      .set({ status: "DEACTIVATED", updatedAt: new Date() })
      .where(eq(promotions.id, id))
      .returning();

    if (!updated) return null;

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: id,
      action: "PROMOTION_DEACTIVATED",
      performedBy: actorId,
      metadata: { status: "DEACTIVATED" },
    });

    return await this.findById(id);
  }

  /**
   * Get audit logs for a promotion
   */
  async getAuditLogs(promotionId: string): Promise<PromotionAuditLog[]> {
    const logs = await db
      .select()
      .from(promotionAuditLogs)
      .where(
        and(
          eq(promotionAuditLogs.entityType, "PROMOTION"),
          eq(promotionAuditLogs.entityId, promotionId),
        ),
      )
      .orderBy(desc(promotionAuditLogs.createdAt));

    return logs.map((l) => ({
      id: l.id,
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      performedBy: l.performedBy,
      metadata: (l.metadata as Record<string, unknown>) ?? null,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  /**
   * Get redemptions for a promotion
   */
  async getRedemptions(
    promotionId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ redemptions: PromotionRedemption[]; total: number }> {
    const records = await db
      .select()
      .from(promotionRedemptions)
      .where(eq(promotionRedemptions.promotionId, promotionId))
      .orderBy(desc(promotionRedemptions.redeemedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promotionRedemptions)
      .where(eq(promotionRedemptions.promotionId, promotionId));

    const total = countResult?.count ?? 0;

    return {
      redemptions: records.map((r) => ({
        id: r.id,
        promotionId: r.promotionId,
        couponId: r.couponId,
        reservationId: r.reservationId,
        userId: r.userId,
        orderId: r.orderId,
        discountAmount: Number(r.discountAmount),
        redeemedAt: r.redeemedAt.toISOString(),
      })),
      total,
    };
  }

  /**
   * Get overview statistics for promotions
   */
  async getOverview(): Promise<PromotionOverviewResponse> {
    const [totalPromos] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promotions);

    const [activePromos] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promotions)
      .where(eq(promotions.status, "ACTIVE"));

    const [totalCoupons] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponCodes);

    const [redemptionsSummary] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalDiscount: sql<string>`coalesce(sum(discount_amount), 0)`,
      })
      .from(promotionRedemptions);

    const [activeReservations] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promotionReservations)
      .where(
        and(
          eq(promotionReservations.status, "RESERVED"),
          sql`${promotionReservations.expiresAt} > NOW()`,
        ),
      );

    const topPromotionsRows = await db
      .select({
        promotionId: promotionRedemptions.promotionId,
        name: promotions.name,
        redemptionsCount: sql<number>`count(*)::int`,
        discountGiven: sql<string>`coalesce(sum(${promotionRedemptions.discountAmount}), 0)`,
      })
      .from(promotionRedemptions)
      .innerJoin(
        promotions,
        eq(promotionRedemptions.promotionId, promotions.id),
      )
      .groupBy(promotionRedemptions.promotionId, promotions.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    return {
      totalPromotions: totalPromos?.count ?? 0,
      activePromotions: activePromos?.count ?? 0,
      totalCoupons: totalCoupons?.count ?? 0,
      totalRedemptions: redemptionsSummary?.count ?? 0,
      totalDiscountGiven: Number(redemptionsSummary?.totalDiscount ?? 0),
      activeReservationsCount: activeReservations?.count ?? 0,
      topPromotions: topPromotionsRows.map((r) => ({
        promotionId: r.promotionId,
        name: r.name,
        redemptionsCount: r.redemptionsCount,
        discountGiven: Number(r.discountGiven),
      })),
    };
  }

  // --- Mappers ---
  private mapPromotion(p: typeof promotions.$inferSelect): Promotion {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status as Promotion["status"],
      type: p.type as Promotion["type"],
      discountValue: Number(p.discountValue),
      maxDiscountAmount: p.maxDiscountAmount
        ? Number(p.maxDiscountAmount)
        : null,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      priority: p.priority,
      isStackable: p.isStackable,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private mapRule(r: typeof promotionRules.$inferSelect): PromotionRule {
    return {
      id: r.id,
      promotionId: r.promotionId,
      minOrderAmount: Number(r.minOrderAmount),
      customerSegment: r.customerSegment as PromotionRule["customerSegment"],
      maxPerCustomer: r.maxPerCustomer,
      globalLimit: r.globalLimit,
      usageCount: r.usageCount,
    };
  }

  private mapTarget(t: typeof promotionTargets.$inferSelect): PromotionTarget {
    return {
      id: t.id,
      promotionId: t.promotionId,
      targetType: t.targetType as PromotionTarget["targetType"],
      targetId: t.targetId,
      ruleType: t.ruleType as PromotionTarget["ruleType"],
    };
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

  private mapBudget(b: typeof promotionBudgets.$inferSelect): PromotionBudget {
    return {
      id: b.id,
      promotionId: b.promotionId,
      totalBudget: Number(b.totalBudget),
      reservedAmount: Number(b.reservedAmount),
      spentAmount: Number(b.spentAmount),
      currency: b.currency,
    };
  }
}

export const promotionRepository = new PromotionRepository();
