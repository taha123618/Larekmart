import type { CartTotalsType } from "@repo/types";
import {
  calculateCouponDiscount,
  VALID_PROMOTIONS,
  type CouponRule,
} from "./discounts.js";

export interface ItemPricingInput {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
}

export interface CouponPricingInput {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
}

export interface PricingCalculationResult {
  pricing: CartTotalsType;
  coupons: Array<{
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    appliedAmount: number;
    minOrderAmount?: number;
  }>;
}

export const calculateCartTotals = (
  items: ItemPricingInput[],
  coupons: CouponPricingInput[] = [],
): PricingCalculationResult => {
  // 1. Calculate raw items subtotal
  const subtotal = items.reduce((acc, item) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    return acc + itemSubtotal;
  }, 0);

  // 2. Calculate coupons / promotions
  let discountTotal = 0;
  const evaluatedCoupons: PricingCalculationResult["coupons"] = [];

  for (const coupon of coupons) {
    const rule: CouponRule = VALID_PROMOTIONS[coupon.code] || {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
    };

    const evalResult = calculateCouponDiscount(rule, subtotal);
    if (evalResult.isValid) {
      discountTotal += evalResult.appliedAmount;
      evaluatedCoupons.push({
        code: coupon.code,
        discountType: rule.discountType,
        discountValue: rule.discountValue,
        appliedAmount: evalResult.appliedAmount,
        minOrderAmount: rule.minOrderAmount,
      });
    }
  }

  // Ensure discount does not exceed subtotal
  discountTotal = Math.min(discountTotal, subtotal);

  // 3. Estimated shipping (e.g. Free shipping above 3000 PKR, else 200 PKR; 0 if empty cart)
  let shippingTotal = 0;
  if (subtotal > 0) {
    shippingTotal = subtotal >= 3000 ? 0 : 200;
  }

  // 4. Estimated tax (e.g. 0% for clothing or can be configured)
  const taxTotal = 0;

  // 5. Grand total
  const grandTotal = Math.max(
    0,
    subtotal - discountTotal + shippingTotal + taxTotal,
  );

  return {
    pricing: {
      subtotal,
      discountTotal,
      taxTotal,
      shippingTotal,
      grandTotal,
    },
    coupons: evaluatedCoupons,
  };
};
