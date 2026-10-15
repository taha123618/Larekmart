import { eq, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { promotionBudgets } from "../db/schema.js";
import type { PromotionBudget } from "@repo/types";

export class BudgetRepository {
  /**
   * Find budget for a promotion
   */
  async findByPromotionId(
    promotionId: string,
    client = db,
  ): Promise<PromotionBudget | null> {
    const [b] = await client
      .select()
      .from(promotionBudgets)
      .where(eq(promotionBudgets.promotionId, promotionId));
    return b ? this.mapBudget(b) : null;
  }

  /**
   * Atomically reserve an amount against the promotion budget.
   * If total_budget is reached (spent + reserved + amount > total_budget), returns success: false.
   * If no budget is configured for this promotion, reservations are unconstrained by budget (returns success: true).
   */
  async reserveBudget(
    promotionId: string,
    amount: number,
    client = db,
  ): Promise<{
    success: boolean;
    budget?: PromotionBudget;
    exhausted?: boolean;
  }> {
    const budget = await this.findByPromotionId(promotionId, client);
    if (!budget) {
      // No budget cap defined
      return { success: true };
    }

    if (
      budget.spentAmount + budget.reservedAmount + amount >
      budget.totalBudget
    ) {
      return { success: false, exhausted: true };
    }

    const [updated] = await client
      .update(promotionBudgets)
      .set({
        reservedAmount: sql`${promotionBudgets.reservedAmount} + ${amount.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(
        sql`${promotionBudgets.promotionId} = ${promotionId} AND (${promotionBudgets.spentAmount} + ${promotionBudgets.reservedAmount} + ${amount.toFixed(2)} <= ${promotionBudgets.totalBudget})`,
      )
      .returning();

    if (!updated) {
      return { success: false, exhausted: true };
    }

    const mapped = this.mapBudget(updated);
    const isNowExhausted =
      mapped.spentAmount + mapped.reservedAmount >= mapped.totalBudget;

    return {
      success: true,
      budget: mapped,
      exhausted: isNowExhausted,
    };
  }

  /**
   * Commit a reserved amount into spent_amount upon order completion.
   */
  async commitBudget(
    promotionId: string,
    amount: number,
    client = db,
  ): Promise<{ budget?: PromotionBudget; exhausted: boolean }> {
    const [updated] = await client
      .update(promotionBudgets)
      .set({
        reservedAmount: sql`GREATEST(0, ${promotionBudgets.reservedAmount} - ${amount.toFixed(2)})`,
        spentAmount: sql`${promotionBudgets.spentAmount} + ${amount.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(eq(promotionBudgets.promotionId, promotionId))
      .returning();

    if (!updated) {
      return { exhausted: false };
    }

    const mapped = this.mapBudget(updated);
    const isExhausted = mapped.spentAmount >= mapped.totalBudget;

    return {
      budget: mapped,
      exhausted: isExhausted,
    };
  }

  /**
   * Release a reserved amount on checkout failure/abandonment.
   */
  async releaseBudget(
    promotionId: string,
    amount: number,
    client = db,
  ): Promise<PromotionBudget | null> {
    const [updated] = await client
      .update(promotionBudgets)
      .set({
        reservedAmount: sql`GREATEST(0, ${promotionBudgets.reservedAmount} - ${amount.toFixed(2)})`,
        updatedAt: new Date(),
      })
      .where(eq(promotionBudgets.promotionId, promotionId))
      .returning();

    return updated ? this.mapBudget(updated) : null;
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

export const budgetRepository = new BudgetRepository();
