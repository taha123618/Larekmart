import { Decimal } from "decimal.js";
import type {
  PriceQuoteItem,
  PriceQuoteItemInput,
  PriceRule,
} from "@repo/types";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ItemPriceContext {
  productId: string;
  variantId?: string | null;
  basePrice: number | string;
  rules?: PriceRule[];
}

export interface CalculationInput {
  items: Array<
    PriceQuoteItemInput & { basePrice: number | string; rules?: PriceRule[] }
  >;
  promotionDiscount?: number | string;
  currency?: string;
}

export interface CalculationResult {
  items: PriceQuoteItem[];
  subtotal: number;
  totalDiscount: number;
  promotionDiscount: number;
  finalTotal: number;
  currency: string;
}

/**
 * Evaluates best applicable price rule for an item based on volume tiers & priority
 */
export function evaluateBestRule(
  quantity: number,
  rules: PriceRule[] = [],
): PriceRule | null {
  const now = new Date();

  const matchingRules = rules.filter((r) => {
    if (!r.isActive) return false;
    if (r.validFrom && new Date(r.validFrom) > now) return false;
    if (r.validTo && new Date(r.validTo) < now) return false;
    if (quantity < r.minQuantity) return false;
    if (
      r.maxQuantity !== null &&
      r.maxQuantity !== undefined &&
      quantity > r.maxQuantity
    ) {
      return false;
    }
    return true;
  });

  if (matchingRules.length === 0) return null;

  // Sort by priority descending, then minQuantity descending (most specific tier first)
  matchingRules.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return b.minQuantity - a.minQuantity;
  });

  return matchingRules[0] ?? null;
}

/**
 * Calculates item pricing using Decimal.js and prevents negative prices
 */
export function calculateItemPrice(
  basePriceInput: number | string,
  quantity: number,
  rule: PriceRule | null,
  productId: string,
  variantId?: string | null,
): PriceQuoteItem {
  const decBase = new Decimal(basePriceInput);
  if (decBase.isNegative()) {
    throw new Error(`Base price for product ${productId} cannot be negative`);
  }

  const decQty = new Decimal(quantity);
  if (decQty.lte(0)) {
    throw new Error("Quantity must be greater than zero");
  }

  let decTierPrice = decBase;
  let decUnitDiscount = new Decimal(0);
  let appliedRuleId: string | null = null;

  if (rule) {
    appliedRuleId = rule.id;
    const decVal = new Decimal(rule.discountValue);

    switch (rule.discountType) {
      case "percentage": {
        // percentage discount off base price
        const pct = decVal.dividedBy(100);
        decUnitDiscount = decBase.times(pct);
        decTierPrice = decBase.minus(decUnitDiscount);
        break;
      }
      case "fixed_amount": {
        // fixed dollar amount off per unit
        decUnitDiscount = decVal;
        decTierPrice = decBase.minus(decUnitDiscount);
        break;
      }
      case "override_price": {
        // direct unit price override
        decTierPrice = decVal;
        decUnitDiscount = decBase.minus(decTierPrice);
        break;
      }
    }
  }

  // Safety Hardening: Prevent negative unit prices
  if (decTierPrice.isNegative()) {
    decTierPrice = new Decimal(0);
    decUnitDiscount = decBase;
  }
  if (decUnitDiscount.isNegative()) {
    decUnitDiscount = new Decimal(0);
  }

  const lineTotal = decTierPrice.times(decQty).toDecimalPlaces(2);

  return {
    productId,
    variantId: variantId || null,
    quantity,
    unitBasePrice: decBase.toDecimalPlaces(2).toNumber(),
    unitTierPrice: decTierPrice.toDecimalPlaces(2).toNumber(),
    unitDiscount: decUnitDiscount.toDecimalPlaces(2).toNumber(),
    unitFinalPrice: decTierPrice.toDecimalPlaces(2).toNumber(),
    lineTotal: lineTotal.toNumber(),
    appliedRuleId,
  };
}

/**
 * Calculates complete pricing quote with subtotal, rule discounts, promo deductions, and final total
 */
export function calculateQuote(input: CalculationInput): CalculationResult {
  let subtotalDec = new Decimal(0);
  let totalDiscountDec = new Decimal(0);
  const calculatedItems: PriceQuoteItem[] = [];

  for (const item of input.items) {
    const bestRule = evaluateBestRule(item.quantity, item.rules);
    const calculated = calculateItemPrice(
      item.basePrice,
      item.quantity,
      bestRule,
      item.productId,
      item.variantId,
    );

    calculatedItems.push(calculated);

    const itemBaseLine = new Decimal(calculated.unitBasePrice).times(
      item.quantity,
    );
    subtotalDec = subtotalDec.plus(itemBaseLine);

    const itemDiscountTotal = new Decimal(calculated.unitDiscount).times(
      item.quantity,
    );
    totalDiscountDec = totalDiscountDec.plus(itemDiscountTotal);
  }

  const promoDiscountDec = new Decimal(input.promotionDiscount || 0);

  // Final total = (Subtotal - Tier/Bulk Discounts) - Promotion Discounts
  const merchandiseTotal = subtotalDec.minus(totalDiscountDec);
  let finalTotalDec = merchandiseTotal.minus(promoDiscountDec);

  // Hardening: Final total cannot be negative
  if (finalTotalDec.isNegative()) {
    finalTotalDec = new Decimal(0);
  }

  return {
    items: calculatedItems,
    subtotal: subtotalDec.toDecimalPlaces(2).toNumber(),
    totalDiscount: totalDiscountDec.toDecimalPlaces(2).toNumber(),
    promotionDiscount: promoDiscountDec.toDecimalPlaces(2).toNumber(),
    finalTotal: finalTotalDec.toDecimalPlaces(2).toNumber(),
    currency: (input.currency || "USD").toUpperCase(),
  };
}
