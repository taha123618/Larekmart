import type { CartTotalsType } from "@repo/types";
import type { CartPricingSnapshotDocType } from "@repo/cart-db";

export const createPricingSnapshot = (
  totals: CartTotalsType,
  currency: string = "PKR",
): CartPricingSnapshotDocType => {
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    shippingTotal: totals.shippingTotal,
    grandTotal: totals.grandTotal,
    currency,
    calculatedAt: new Date(),
  };
};
