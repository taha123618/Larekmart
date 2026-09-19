import type { CartDocType } from "@repo/cart-db";
import { calculateCartTotals } from "../pricing/calculator.js";
import { createPricingSnapshot } from "../pricing/totals.js";

export class PricingService {
  /**
   * Recalculates cart items subtotals, evaluates coupons, and saves snapshot
   */
  recalculateCart(cart: CartDocType): void {
    const rawItems = cart.items || [];
    const rawCoupons = cart.coupons || [];

    // Recalculate item subtotals
    for (const item of rawItems) {
      item.subtotal = item.unitPrice * item.quantity;
    }

    const { pricing, coupons } = calculateCartTotals(
      rawItems.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountAmount: item.discountAmount || 0,
      })),
      rawCoupons.map((c) => ({
        code: c.code,
        discountType: c.discountType as any,
        discountValue: c.discountValue,
        minOrderAmount: c.minOrderAmount,
      })),
    );

    cart.pricing = pricing;

    // Update applied amounts on coupons
    for (let i = 0; i < cart.coupons.length; i++) {
      const evalCoupon = coupons.find((c) => c.code === cart.coupons[i]!.code);
      if (evalCoupon) {
        cart.coupons[i]!.appliedAmount = evalCoupon.appliedAmount;
      }
    }

    // Save immutable point-in-time calculation snapshot
    const snapshot = createPricingSnapshot(pricing, cart.currency || "PKR");
    if (!cart.snapshots) {
      (cart as any).snapshots = [];
    }
    cart.snapshots.push(snapshot as any);

    // Keep snapshots array bounded to last 10 calculations
    while (cart.snapshots.length > 10) {
      cart.snapshots.shift();
    }
  }
}

export const pricingService = new PricingService();
