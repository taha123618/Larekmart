import Decimal from "decimal.js";
import type {
  CommissionLineItemInput,
  CommissionLineItemResult,
  CommissionCalculationType,
} from "@repo/types";

export interface ResolvableCommissionRule {
  id: string;
  planId: string;
  ruleType: string;
  scope: string;
  scopeId?: string | null;
  percentageRate?: string | number | null;
  fixedAmount?: string | number | null;
  minCommission?: string | number | null;
  maxCommission?: string | number | null;
  priority: number;
  status: string;
}

export class CommissionCalculator {
  /**
   * Resolves the best matching commission rule for an item based on precedence:
   * 1. PRODUCT scope (specific product override)
   * 2. SELLER scope (merchant-negotiated rate)
   * 3. CATEGORY scope (category baseline)
   * 4. GLOBAL scope (platform fallback)
   */
  public static resolveBestRule(
    item: CommissionLineItemInput,
    rules: ResolvableCommissionRule[],
  ): ResolvableCommissionRule {
    const activeRules = rules.filter((r) => r.status === "ACTIVE");

    // 1. PRODUCT Match
    const productRule = activeRules.find(
      (r) =>
        r.scope === "PRODUCT" &&
        r.scopeId &&
        String(r.scopeId) === String(item.productId),
    );
    if (productRule) return productRule;

    // 2. SELLER Match
    const sellerRule = activeRules.find(
      (r) =>
        r.scope === "SELLER" &&
        r.scopeId &&
        String(r.scopeId) === String(item.sellerId),
    );
    if (sellerRule) return sellerRule;

    // 3. CATEGORY Match
    const categoryRule = activeRules.find(
      (r) =>
        r.scope === "CATEGORY" &&
        r.scopeId &&
        String(r.scopeId) === String(item.categoryId),
    );
    if (categoryRule) return categoryRule;

    // 4. Highest priority GLOBAL fallback
    const globalRules = activeRules
      .filter((r) => r.scope === "GLOBAL")
      .sort((a, b) => b.priority - a.priority);

    if (globalRules[0]) return globalRules[0];

    // Extreme fallback (default 8% platform commission)
    return {
      id: "rule_fallback_8pct",
      planId: "plan_default",
      ruleType: "PERCENTAGE",
      scope: "GLOBAL",
      percentageRate: "8.00",
      fixedAmount: "0.00",
      priority: 0,
      status: "ACTIVE",
    };
  }

  /**
   * Calculates the exact commission fee for a single line item using Decimal.js.
   */
  public static calculateLineItem(
    item: CommissionLineItemInput,
    rule: ResolvableCommissionRule,
    ruleVersion = 1,
  ): CommissionLineItemResult {
    const itemPrice = new Decimal(item.itemPrice);
    const quantity = new Decimal(item.quantity);
    const commissionableAmount = itemPrice.mul(quantity);

    const rate = new Decimal(rule.percentageRate || 0);
    const fixed = new Decimal(rule.fixedAmount || 0);

    // Initial fee: (commissionableAmount * rate / 100) + (fixed * quantity)
    let calculatedFee = commissionableAmount
      .mul(rate)
      .div(100)
      .plus(fixed.mul(quantity));

    let minMaxApplied = false;

    // Apply minimum fee limit
    if (rule.minCommission != null) {
      const minFee = new Decimal(rule.minCommission);
      if (calculatedFee.lt(minFee)) {
        calculatedFee = minFee;
        minMaxApplied = true;
      }
    }

    // Apply maximum fee limit
    if (rule.maxCommission != null) {
      const maxFee = new Decimal(rule.maxCommission);
      if (calculatedFee.gt(maxFee)) {
        calculatedFee = maxFee;
        minMaxApplied = true;
      }
    }

    // Guarantee non-negative
    if (calculatedFee.isNegative()) {
      calculatedFee = new Decimal(0);
    }

    // Never exceed the total commissionable amount
    if (calculatedFee.gt(commissionableAmount)) {
      calculatedFee = commissionableAmount;
    }

    return {
      orderItemId: item.orderItemId,
      productId: String(item.productId),
      categoryId: item.categoryId,
      sellerId: item.sellerId,
      itemPrice: itemPrice.toDecimalPlaces(2).toNumber(),
      quantity: item.quantity,
      commissionableAmount: commissionableAmount.toDecimalPlaces(2).toNumber(),
      ruleId: rule.id,
      ruleVersion,
      rateApplied: rate.toDecimalPlaces(2).toNumber(),
      feeCalculated: calculatedFee.toDecimalPlaces(2).toNumber(),
      minMaxApplied,
    };
  }

  /**
   * Calculates order-level calculations grouped by seller.
   */
  public static calculateOrderCommissions(
    orderId: string,
    items: CommissionLineItemInput[],
    rules: ResolvableCommissionRule[],
    currency = "PKR",
  ): CommissionCalculationType[] {
    // Group items by seller
    const itemsBySeller = new Map<string, CommissionLineItemInput[]>();
    for (const item of items) {
      const list = itemsBySeller.get(item.sellerId) || [];
      list.push(item);
      itemsBySeller.set(item.sellerId, list);
    }

    const calculations: CommissionCalculationType[] = [];

    for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
      let subtotal = new Decimal(0);
      let totalCommission = new Decimal(0);
      const lineItemResults: CommissionLineItemResult[] = [];

      for (const item of sellerItems) {
        const bestRule = this.resolveBestRule(item, rules);
        const result = this.calculateLineItem(item, bestRule, 1);
        lineItemResults.push(result);

        subtotal = subtotal.plus(result.commissionableAmount);
        totalCommission = totalCommission.plus(result.feeCalculated);
      }

      const netSellerPayout = subtotal.minus(totalCommission);

      calculations.push({
        id: `calc_${orderId}_${sellerId}`,
        orderId,
        sellerId,
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        totalCommission: totalCommission.toDecimalPlaces(2).toNumber(),
        netSellerPayout: netSellerPayout.toDecimalPlaces(2).toNumber(),
        currency,
        status: "QUOTED",
        lineItems: lineItemResults,
        calculationSnapshot: {
          calculatedAt: new Date().toISOString(),
          itemCount: sellerItems.length,
          rulesApplied: lineItemResults.map((r) => ({
            orderItemId: r.orderItemId,
            ruleId: r.ruleId,
            rateApplied: r.rateApplied,
            feeCalculated: r.feeCalculated,
          })),
        },
      });
    }

    return calculations;
  }
}
