import Decimal from "decimal.js";

export interface ItemProrationInput {
  orderItemId: string;
  productId: string;
  variantId?: string;
  returnedQuantity: number;
  originalQuantity: number;
  unitPrice: string | number;
  itemDiscount?: string | number;
  taxAmount?: string | number;
  reason: string;
  condition: string;
  customerNote?: string;
}

export interface ProrationResult {
  items: Array<{
    orderItemId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: string;
    itemDiscount: string;
    proratedTax: string;
    refundSubtotal: string;
    reason: string;
    condition: string;
    customerNote?: string;
  }>;
  subtotalRefund: string;
  taxRefund: string;
  shippingDeduction: string;
  totalRefund: string;
}

export class ProrationService {
  calculateProratedRefund(
    items: ItemProrationInput[],
    shippingDeductionAmount = "0.00",
  ): ProrationResult {
    let totalSubtotal = new Decimal(0);
    let totalTax = new Decimal(0);

    const calculatedItems = items.map((item) => {
      const qty = new Decimal(item.returnedQuantity);
      const origQty = new Decimal(item.originalQuantity);
      const unitPrice = new Decimal(item.unitPrice);
      const origDiscount = new Decimal(item.itemDiscount || 0);
      const origTax = new Decimal(item.taxAmount || 0);

      // Prorated discount for the returned quantity: (origDiscount / origQty) * qty
      const discountPerUnit = origQty.isZero()
        ? new Decimal(0)
        : origDiscount.div(origQty);
      const proratedItemDiscount = discountPerUnit
        .mul(qty)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Gross total for returned quantity
      const grossSubtotal = unitPrice.mul(qty);

      // Net refund subtotal after discount
      const refundSubtotal = grossSubtotal
        .minus(proratedItemDiscount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Prorated tax for returned quantity
      const taxPerUnit = origQty.isZero()
        ? new Decimal(0)
        : origTax.div(origQty);
      const proratedTax = taxPerUnit
        .mul(qty)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      totalSubtotal = totalSubtotal.plus(refundSubtotal);
      totalTax = totalTax.plus(proratedTax);

      return {
        orderItemId: item.orderItemId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.returnedQuantity,
        unitPrice: unitPrice.toFixed(2),
        itemDiscount: proratedItemDiscount.toFixed(2),
        proratedTax: proratedTax.toFixed(2),
        refundSubtotal: refundSubtotal.toFixed(2),
        reason: item.reason,
        condition: item.condition,
        customerNote: item.customerNote,
      };
    });

    const shippingDeduction = new Decimal(shippingDeductionAmount);
    let totalRefund = totalSubtotal.plus(totalTax).minus(shippingDeduction);
    if (totalRefund.isNegative()) {
      totalRefund = new Decimal(0);
    }

    return {
      items: calculatedItems,
      subtotalRefund: totalSubtotal.toFixed(2),
      taxRefund: totalTax.toFixed(2),
      shippingDeduction: shippingDeduction.toFixed(2),
      totalRefund: totalRefund.toFixed(2),
    };
  }
}

export const prorationService = new ProrationService();
