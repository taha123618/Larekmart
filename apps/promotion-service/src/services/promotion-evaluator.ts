import type {
  Promotion,
  CartItemContext,
  CustomerSegment,
  DiscountBreakdown,
  PromotionQuoteResponse,
} from "@repo/types";

export interface CustomerEvaluationContext {
  userId?: string;
  guestId?: string;
  segment?: CustomerSegment;
  customerUsageCount?: number;
}

export interface EvaluationResult {
  eligible: boolean;
  discountAmount: number;
  freeShipping: boolean;
  reason?: string;
  appliedToItemIds?: number[];
}

export class PromotionEvaluator {
  /**
   * Evaluate if a single promotion applies to a cart and calculate discount.
   */
  evaluatePromotion(
    promotion: Promotion,
    items: CartItemContext[],
    customerContext: CustomerEvaluationContext = {},
  ): EvaluationResult {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);

    // 1. Check status and date range
    if (promotion.status !== "ACTIVE") {
      return {
        eligible: false,
        discountAmount: 0,
        freeShipping: false,
        reason: `Promotion is ${promotion.status}`,
      };
    }

    if (now < startDate || now > endDate) {
      return {
        eligible: false,
        discountAmount: 0,
        freeShipping: false,
        reason: "Promotion is outside its valid date range",
      };
    }

    // 2. Check rules (limits & customer segment)
    if (promotion.rules) {
      const { globalLimit, usageCount, maxPerCustomer, customerSegment } = promotion.rules;

      if (globalLimit != null && usageCount >= globalLimit) {
        return {
          eligible: false,
          discountAmount: 0,
          freeShipping: false,
          reason: "Promotion global redemption limit reached",
        };
      }

      const userUsage = customerContext.customerUsageCount ?? 0;
      if (userUsage >= maxPerCustomer) {
        return {
          eligible: false,
          discountAmount: 0,
          freeShipping: false,
          reason: `Customer redemption limit of ${maxPerCustomer} reached`,
        };
      }

      if (customerSegment && customerSegment !== "ALL") {
        const userSegment = customerContext.segment ?? "ALL";
        if (userSegment !== customerSegment) {
          return {
            eligible: false,
            discountAmount: 0,
            freeShipping: false,
            reason: `Promotion restricted to ${customerSegment} customer segment`,
          };
        }
      }
    }

    // 3. Evaluate item targets (exclusions and inclusions)
    const targets = promotion.targets ?? [];
    const includeTargets = targets.filter((t) => t.ruleType === "INCLUDE");
    const excludeTargets = targets.filter((t) => t.ruleType === "EXCLUDE");

    const eligibleItems: CartItemContext[] = [];

    for (const item of items) {
      // Check exclusions first
      const isExcluded = excludeTargets.some((t) => {
        if (t.targetType === "PRODUCT" && t.targetId === item.productId.toString()) return true;
        if (t.targetType === "CATEGORY" && item.categoryId && t.targetId === item.categoryId) return true;
        if (t.targetType === "SELLER" && item.sellerId && t.targetId === item.sellerId) return true;
        return false;
      });

      if (isExcluded) {
        continue;
      }

      // Check inclusions
      if (includeTargets.length > 0) {
        const isIncluded = includeTargets.some((t) => {
          if (t.targetType === "ORDER") return true;
          if (t.targetType === "PRODUCT" && t.targetId === item.productId.toString()) return true;
          if (t.targetType === "CATEGORY" && item.categoryId && t.targetId === item.categoryId) return true;
          if (t.targetType === "SELLER" && item.sellerId && t.targetId === item.sellerId) return true;
          return false;
        });

        if (isIncluded) {
          eligibleItems.push(item);
        }
      } else {
        // No inclusion restrictions => applies to all non-excluded items
        eligibleItems.push(item);
      }
    }

    if (eligibleItems.length === 0) {
      return {
        eligible: false,
        discountAmount: 0,
        freeShipping: false,
        reason: "No items in cart meet promotion targeting criteria",
      };
    }

    // 4. Calculate eligible subtotal
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, item) => sum + item.price * (item.quantity ?? 1),
      0,
    );

    const minOrderAmount = promotion.rules?.minOrderAmount ?? 0;
    if (eligibleSubtotal < minOrderAmount) {
      return {
        eligible: false,
        discountAmount: 0,
        freeShipping: false,
        reason: `Eligible item subtotal of $${eligibleSubtotal.toFixed(2)} is less than minimum required $${minOrderAmount.toFixed(2)}`,
      };
    }

    // 5. Calculate discount amount
    let discount = 0;
    let isFreeShipping = false;

    if (promotion.type === "FREE_SHIPPING") {
      isFreeShipping = true;
      discount = 0;
    } else if (promotion.type === "PERCENTAGE") {
      discount = eligibleSubtotal * (promotion.discountValue / 100);
      if (promotion.maxDiscountAmount != null && promotion.maxDiscountAmount > 0) {
        discount = Math.min(discount, promotion.maxDiscountAmount);
      }
      discount = Math.min(discount, eligibleSubtotal);
    } else if (promotion.type === "FIXED_AMOUNT") {
      discount = Math.min(promotion.discountValue, eligibleSubtotal);
    }

    return {
      eligible: true,
      discountAmount: Number(discount.toFixed(2)),
      freeShipping: isFreeShipping,
      appliedToItemIds: eligibleItems.map((i) => i.productId),
    };
  }

  /**
   * Evaluate multiple promotions and coupons against a cart, honoring stacking rules and priorities.
   */
  evaluateCartPromotions(
    promotionsList: Array<{ promotion: Promotion; code?: string }>,
    items: CartItemContext[],
    customerContext: CustomerEvaluationContext = {},
  ): PromotionQuoteResponse {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * (item.quantity ?? 1),
      0,
    );

    // Sort candidates: stackable vs non-stackable, priority DESC
    const sortedCandidates = [...promotionsList].sort(
      (a, b) => (b.promotion.priority ?? 0) - (a.promotion.priority ?? 0),
    );

    const appliedDiscounts: DiscountBreakdown[] = [];
    const invalidCoupons: Array<{ code: string; reason: string }> = [];

    let totalDiscount = 0;
    let freeShipping = false;
    let hasAppliedNonStackable = false;

    for (const candidate of sortedCandidates) {
      const { promotion, code } = candidate;

      // Stacking constraint: if non-stackable already applied, skip
      if (hasAppliedNonStackable) {
        if (code) {
          invalidCoupons.push({
            code,
            reason: "Cannot combine with already applied non-stackable promotion",
          });
        }
        continue;
      }

      // If this promotion is non-stackable and we already applied discounts, skip
      if (!promotion.isStackable && appliedDiscounts.length > 0) {
        if (code) {
          invalidCoupons.push({
            code,
            reason: "Promotion cannot be combined with other discounts",
          });
        }
        continue;
      }

      const evalResult = this.evaluatePromotion(promotion, items, customerContext);

      if (!evalResult.eligible) {
        if (code) {
          invalidCoupons.push({
            code,
            reason: evalResult.reason ?? "Promotion conditions not met",
          });
        }
        continue;
      }

      // Check if discount exceeds remaining subtotal
      const remainingSubtotal = Math.max(0, subtotal - totalDiscount);
      const effectiveDiscount = Math.min(evalResult.discountAmount, remainingSubtotal);

      if (effectiveDiscount > 0 || evalResult.freeShipping) {
        appliedDiscounts.push({
          promotionId: promotion.id,
          promotionName: promotion.name,
          code,
          type: promotion.type,
          discountAmount: effectiveDiscount,
          appliedToItemIds: evalResult.appliedToItemIds,
        });

        totalDiscount += effectiveDiscount;
        if (evalResult.freeShipping) {
          freeShipping = true;
        }

        if (!promotion.isStackable) {
          hasAppliedNonStackable = true;
        }
      }
    }

    const finalTotal = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      finalTotal,
      freeShipping,
      appliedDiscounts,
      invalidCoupons,
    };
  }
}

export const promotionEvaluator = new PromotionEvaluator();
