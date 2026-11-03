import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  commissionPlans,
  commissionRules,
  commissionRuleVersions,
  commissionCalculations,
  commissionLineItems,
  commissionAdjustments,
} from "../db/schema.js";
import {
  CommissionCalculator,
  type ResolvableCommissionRule,
} from "../engine/commission-calculator.js";
import { commissionEventProducer } from "../kafka/producer.js";
import type {
  CommissionQuoteRequest,
  CommissionQuoteResponse,
  CommissionCalculationType,
} from "@repo/types";
import { v4 as uuidv4 } from "uuid";
import Decimal from "decimal.js";

export class CommissionService {
  /**
   * Loads all active commission rules from the default active plan.
   * If DB is offline or empty, falls back to the default 8% platform rule.
   */
  public async getActiveRules(): Promise<ResolvableCommissionRule[]> {
    try {
      const defaultPlan = await db
        .select()
        .from(commissionPlans)
        .where(
          and(
            eq(commissionPlans.isDefault, true),
            eq(commissionPlans.status, "ACTIVE"),
          ),
        )
        .limit(1);

      const planId = defaultPlan[0]?.id || "plan_default_marketplace";

      const rules = await db
        .select()
        .from(commissionRules)
        .where(
          and(
            eq(commissionRules.planId, planId),
            eq(commissionRules.status, "ACTIVE"),
          ),
        );

      if (rules.length > 0) {
        return rules.map((r) => ({
          id: r.id,
          planId: r.planId,
          ruleType: r.ruleType,
          scope: r.scope,
          scopeId: r.scopeId,
          percentageRate: r.percentageRate,
          fixedAmount: r.fixedAmount,
          minCommission: r.minCommission,
          maxCommission: r.maxCommission,
          priority: r.priority,
          status: r.status,
        }));
      }
    } catch {
      // Standalone mode or DB connection warmup fallback
    }

    return [
      {
        id: "rule_default_global_8pct",
        planId: "plan_default_marketplace",
        ruleType: "PERCENTAGE",
        scope: "GLOBAL",
        scopeId: null,
        percentageRate: "8.00",
        fixedAmount: null,
        minCommission: "10.00",
        maxCommission: "5000.00",
        priority: 100,
        status: "ACTIVE",
      },
    ];
  }

  /**
   * Generates a real-time commission quote without persisting state.
   */
  public async createQuote(
    request: CommissionQuoteRequest,
  ): Promise<CommissionQuoteResponse> {
    const rules = await this.getActiveRules();
    const orderId = request.orderId || `quote_${uuidv4()}`;

    const calculations = CommissionCalculator.calculateOrderCommissions(
      orderId,
      request.items,
      rules,
      request.currency,
    );

    let totalSubtotal = new Decimal(0);
    let totalCommission = new Decimal(0);
    let totalNetPayout = new Decimal(0);

    for (const calc of calculations) {
      totalSubtotal = totalSubtotal.plus(calc.subtotal);
      totalCommission = totalCommission.plus(calc.totalCommission);
      totalNetPayout = totalNetPayout.plus(calc.netSellerPayout);

      // Emit ephemeral calculated event
      await commissionEventProducer.publishCommissionCalculated({
        calculationId: calc.id,
        orderId,
        sellerId: calc.sellerId,
        currency: calc.currency,
        subtotal: calc.subtotal,
        totalCommission: calc.totalCommission,
        netSellerPayout: calc.netSellerPayout,
        lineItems: calc.lineItems,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      orderId: request.orderId,
      currency: request.currency,
      totalSubtotal: totalSubtotal.toDecimalPlaces(2).toNumber(),
      totalCommission: totalCommission.toDecimalPlaces(2).toNumber(),
      totalNetPayout: totalNetPayout.toDecimalPlaces(2).toNumber(),
      calculationsBySeller: calculations,
    };
  }

  /**
   * Authoritatively accrues commissions for a placed/confirmed order.
   * Persists calculations, line items, and emits commission.accrued.
   */
  public async accrueOrderCommissions(
    orderId: string,
    items: CommissionQuoteRequest["items"],
    currency = "PKR",
  ): Promise<CommissionCalculationType[]> {
    const rules = await this.getActiveRules();
    const calculations = CommissionCalculator.calculateOrderCommissions(
      orderId,
      items,
      rules,
      currency,
    );

    for (const calc of calculations) {
      const calculationId = uuidv4();

      // Persist order calculation
      await db
        .insert(commissionCalculations)
        .values({
          id: calculationId,
          orderId: calc.orderId,
          sellerId: calc.sellerId,
          subtotal: String(calc.subtotal),
          totalCommission: String(calc.totalCommission),
          netSellerPayout: String(calc.netSellerPayout),
          currency: calc.currency,
          status: "ACCRUED",
          calculationSnapshot: calc.calculationSnapshot || {},
        })
        .onConflictDoNothing();

      // Persist line items
      for (const line of calc.lineItems) {
        await db
          .insert(commissionLineItems)
          .values({
            id: uuidv4(),
            calculationId,
            orderId: calc.orderId,
            orderItemId: line.orderItemId,
            productId: line.productId,
            categoryId: line.categoryId,
            sellerId: line.sellerId,
            itemPrice: String(line.itemPrice),
            quantity: line.quantity,
            commissionableAmount: String(line.commissionableAmount),
            ruleId: line.ruleId,
            ruleVersion: line.ruleVersion,
            rateApplied: String(line.rateApplied),
            feeCalculated: String(line.feeCalculated),
            minMaxApplied: line.minMaxApplied,
          })
          .onConflictDoNothing();
      }

      calc.id = calculationId;
      calc.status = "ACCRUED";

      // Publish authoritative commission accrued event
      await commissionEventProducer.publishCommissionAccrued({
        calculationId,
        orderId: calc.orderId,
        sellerId: calc.sellerId,
        currency: calc.currency,
        subtotal: calc.subtotal,
        totalCommission: calc.totalCommission,
        netSellerPayout: calc.netSellerPayout,
        timestamp: new Date().toISOString(),
      });
    }

    return calculations;
  }

  /**
   * Adjusts commissions when items are returned or partially refunded.
   */
  public async adjustCommissionForReturn(params: {
    orderId: string;
    returnId?: string;
    sellerId: string;
    amountToAdjust: number;
    reason: string;
  }): Promise<{ adjustmentId: string; remainingCommission: number }> {
    const existing = await db
      .select()
      .from(commissionCalculations)
      .where(
        and(
          eq(commissionCalculations.orderId, params.orderId),
          eq(commissionCalculations.sellerId, params.sellerId),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      throw new Error(
        `No commission calculation found for order ${params.orderId} and seller ${params.sellerId}`,
      );
    }

    const calc = existing[0];
    const currentComm = new Decimal(calc.totalCommission);
    const adjustDecimal = new Decimal(params.amountToAdjust);
    const remaining = currentComm.minus(adjustDecimal);
    const finalRemaining = remaining.isNegative() ? new Decimal(0) : remaining;

    const adjustmentId = uuidv4();

    await db.insert(commissionAdjustments).values({
      id: adjustmentId,
      calculationId: calc.id,
      orderId: params.orderId,
      returnId: params.returnId,
      adjustmentType: "RETURN_REFUND",
      amountAdjusted: adjustDecimal.toFixed(2),
      reason: params.reason,
      metadata: { previousCommission: calc.totalCommission },
    });

    await db
      .update(commissionCalculations)
      .set({
        totalCommission: finalRemaining.toFixed(2),
        status: "ADJUSTED",
        updatedAt: new Date(),
      })
      .where(eq(commissionCalculations.id, calc.id));

    await commissionEventProducer.publishCommissionAdjusted({
      adjustmentId,
      calculationId: calc.id,
      orderId: params.orderId,
      sellerId: params.sellerId,
      adjustmentType: "RETURN_REFUND",
      amountAdjusted: adjustDecimal.toNumber(),
      remainingCommission: finalRemaining.toNumber(),
      reason: params.reason,
      timestamp: new Date().toISOString(),
    });

    return {
      adjustmentId,
      remainingCommission: finalRemaining.toNumber(),
    };
  }

  /**
   * Reverses commissions when an order is cancelled.
   */
  public async reverseCommissionForOrder(
    orderId: string,
    reason: string,
  ): Promise<void> {
    const existing = await db
      .select()
      .from(commissionCalculations)
      .where(eq(commissionCalculations.orderId, orderId));

    for (const calc of existing) {
      await db
        .update(commissionCalculations)
        .set({
          status: "REVERSED",
          updatedAt: new Date(),
        })
        .where(eq(commissionCalculations.id, calc.id));

      await commissionEventProducer.publishCommissionReversed({
        calculationId: calc.id,
        orderId,
        sellerId: calc.sellerId,
        totalReversedAmount: Number(calc.totalCommission),
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Fetches commission calculation records for a specific order.
   */
  public async getOrderCommissions(orderId: string) {
    const calculations = await db
      .select()
      .from(commissionCalculations)
      .where(eq(commissionCalculations.orderId, orderId));

    const lineItems = await db
      .select()
      .from(commissionLineItems)
      .where(eq(commissionLineItems.orderId, orderId));

    const adjustments = await db
      .select()
      .from(commissionAdjustments)
      .where(eq(commissionAdjustments.orderId, orderId));

    return {
      orderId,
      calculations,
      lineItems,
      adjustments,
    };
  }

  /**
   * Updates a commission rule with automatic immutable versioning.
   */
  public async updateRule(
    ruleId: string,
    updates: Partial<ResolvableCommissionRule>,
    changedBy: string,
    changeReason: string,
  ) {
    const existing = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.id, ruleId))
      .limit(1);

    if (!existing[0]) {
      throw new Error(`Commission rule with id ${ruleId} not found`);
    }

    const currentRule = existing[0];

    // Determine latest version
    const lastVersionRow = await db
      .select({ version: commissionRuleVersions.version })
      .from(commissionRuleVersions)
      .where(eq(commissionRuleVersions.ruleId, ruleId))
      .orderBy(desc(commissionRuleVersions.version))
      .limit(1);

    const nextVersion = (lastVersionRow[0]?.version || 0) + 1;

    // Record immutable snapshot before mutation
    await db.insert(commissionRuleVersions).values({
      id: uuidv4(),
      ruleId,
      version: nextVersion,
      ruleSnapshot: currentRule,
      changedBy,
      changeReason,
      validFrom: currentRule.updatedAt,
      validTo: new Date(),
    });

    // Update rule
    await db
      .update(commissionRules)
      .set({
        ...updates,
        percentageRate:
          updates.percentageRate != null
            ? String(updates.percentageRate)
            : undefined,
        fixedAmount:
          updates.fixedAmount != null ? String(updates.fixedAmount) : undefined,
        minCommission:
          updates.minCommission != null
            ? String(updates.minCommission)
            : undefined,
        maxCommission:
          updates.maxCommission != null
            ? String(updates.maxCommission)
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(commissionRules.id, ruleId));

    return {
      ruleId,
      versionArchived: nextVersion,
      status: "UPDATED",
    };
  }

  /**
   * High-level reporting aggregation for marketplace administrators.
   */
  public async getReports() {
    const totalRevenueRow = await db
      .select({
        totalRevenue: sql<string>`COALESCE(SUM(total_commission), 0)`,
        totalOrders: sql<string>`COUNT(DISTINCT order_id)`,
        activeSellers: sql<string>`COUNT(DISTINCT seller_id)`,
      })
      .from(commissionCalculations)
      .where(eq(commissionCalculations.status, "ACCRUED"));

    const bySeller = await db
      .select({
        sellerId: commissionCalculations.sellerId,
        grossSubtotal: sql<string>`COALESCE(SUM(subtotal), 0)`,
        commissionCollected: sql<string>`COALESCE(SUM(total_commission), 0)`,
        netPayout: sql<string>`COALESCE(SUM(net_seller_payout), 0)`,
        orderCount: sql<string>`COUNT(id)`,
      })
      .from(commissionCalculations)
      .where(eq(commissionCalculations.status, "ACCRUED"))
      .groupBy(commissionCalculations.sellerId)
      .limit(50);

    return {
      summary: {
        totalCommissionRevenue: Number(totalRevenueRow[0]?.totalRevenue || 0),
        totalOrdersProcessed: Number(totalRevenueRow[0]?.totalOrders || 0),
        activeSellersCount: Number(totalRevenueRow[0]?.activeSellers || 0),
      },
      sellerBreakdown: bySeller.map((s) => ({
        sellerId: s.sellerId,
        grossSubtotal: Number(s.grossSubtotal),
        commissionCollected: Number(s.commissionCollected),
        netPayout: Number(s.netPayout),
        orderCount: Number(s.orderCount),
      })),
    };
  }
}

export const commissionService = new CommissionService();
