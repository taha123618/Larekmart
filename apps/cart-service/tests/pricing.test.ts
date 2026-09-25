import assert from "assert";
import { calculateCartTotals } from "../src/pricing/calculator.js";
import { calculateCouponDiscount, VALID_PROMOTIONS } from "../src/pricing/discounts.js";

async function runCartPricingTests() {
  console.log("=== Cart Service Pricing & Discount SQA Test Suite ===\n");

  // 1. Empty Cart Calculation
  console.log("1. Testing Empty Cart Calculation...");
  const emptyResult = calculateCartTotals([]);
  assert.equal(emptyResult.pricing.subtotal, 0, "Empty cart subtotal should be 0");
  assert.equal(emptyResult.pricing.discountTotal, 0, "Empty cart discount should be 0");
  assert.equal(emptyResult.pricing.shippingTotal, 0, "Empty cart shipping should be 0");
  assert.equal(emptyResult.pricing.grandTotal, 0, "Empty cart grand total should be 0");
  assert.equal(emptyResult.coupons.length, 0, "No coupons should be applied to empty cart");
  console.log("✓ Empty cart totals correctly verified");

  // 2. Standard Items without Coupons (Below Free Shipping Threshold)
  console.log("2. Testing Subtotal below Free Shipping Threshold (< 3000 PKR)...");
  const standardResult = calculateCartTotals([
    { unitPrice: 800, quantity: 2 }, // 1600
    { unitPrice: 400, quantity: 1 }, // 400 => subtotal 2000
  ]);
  assert.equal(standardResult.pricing.subtotal, 2000, "Subtotal should be 2000 PKR");
  assert.equal(standardResult.pricing.discountTotal, 0, "Discount should be 0 PKR");
  assert.equal(standardResult.pricing.shippingTotal, 200, "Shipping fee should be 200 PKR when subtotal < 3000");
  assert.equal(standardResult.pricing.grandTotal, 2200, "Grand total should be 2200 PKR (2000 + 200)");
  console.log("✓ Subtotal below shipping threshold verified");

  // 3. Free Shipping Threshold Edge Cases
  console.log("3. Testing Free Shipping Threshold (>= 3000 PKR)...");
  // Exact 3000 PKR boundary test
  const exactThresholdResult = calculateCartTotals([
    { unitPrice: 1500, quantity: 2 }, // 3000
  ]);
  assert.equal(exactThresholdResult.pricing.subtotal, 3000);
  assert.equal(exactThresholdResult.pricing.shippingTotal, 0, "Exact 3000 PKR should qualify for FREE shipping");
  assert.equal(exactThresholdResult.pricing.grandTotal, 3000);

  // 2999 PKR boundary test
  const belowThresholdResult = calculateCartTotals([
    { unitPrice: 2999, quantity: 1 },
  ]);
  assert.equal(belowThresholdResult.pricing.subtotal, 2999);
  assert.equal(belowThresholdResult.pricing.shippingTotal, 200, "2999 PKR must incur 200 PKR shipping");
  assert.equal(belowThresholdResult.pricing.grandTotal, 3199);
  console.log("✓ Free shipping boundary conditions (2999 vs 3000 PKR) verified");

  // 4. Percentage Coupon Application (WELCOME10 - 10% off min 1000)
  console.log("4. Testing Percentage Coupon (WELCOME10)...");
  const welcome10Result = calculateCartTotals(
    [{ unitPrice: 1500, quantity: 1 }],
    [{ code: "WELCOME10", discountType: "percentage", discountValue: 10, minOrderAmount: 1000 }],
  );
  assert.equal(welcome10Result.pricing.subtotal, 1500);
  assert.equal(welcome10Result.pricing.discountTotal, 150, "10% of 1500 should be 150 PKR");
  assert.equal(welcome10Result.pricing.shippingTotal, 200, "Subtotal 1500 < 3000, so shipping is 200");
  assert.equal(welcome10Result.pricing.grandTotal, 1550, "Grand total: 1500 - 150 + 200 = 1550");
  assert.equal(welcome10Result.coupons.length, 1);
  assert.equal(welcome10Result.coupons[0]!.appliedAmount, 150);
  console.log("✓ Percentage coupon applied accurately");

  // 5. Coupon Rejection below Minimum Order Amount
  console.log("5. Testing Coupon Minimum Order Amount Rejection...");
  const rejectedCouponResult = calculateCartTotals(
    [{ unitPrice: 600, quantity: 1 }], // 600 < minOrderAmount 1000
    [{ code: "WELCOME10", discountType: "percentage", discountValue: 10, minOrderAmount: 1000 }],
  );
  assert.equal(rejectedCouponResult.pricing.subtotal, 600);
  assert.equal(rejectedCouponResult.pricing.discountTotal, 0, "Coupon must be rejected when subtotal < minOrderAmount");
  assert.equal(rejectedCouponResult.pricing.grandTotal, 800, "Grand total: 600 + 200 shipping = 800");
  assert.equal(rejectedCouponResult.coupons.length, 0, "No coupon should be in evaluated list");
  console.log("✓ Coupon rejection below threshold verified");

  // 6. Fixed Discount Coupon Application (SAVE500 - 500 PKR off min 2500)
  console.log("6. Testing Fixed Discount Coupon (SAVE500)...");
  const fixedCouponResult = calculateCartTotals(
    [{ unitPrice: 1400, quantity: 2 }], // 2800
    [{ code: "SAVE500", discountType: "fixed", discountValue: 500, minOrderAmount: 2500 }],
  );
  assert.equal(fixedCouponResult.pricing.subtotal, 2800);
  assert.equal(fixedCouponResult.pricing.discountTotal, 500, "Fixed discount should be 500 PKR");
  assert.equal(fixedCouponResult.pricing.shippingTotal, 200, "2800 < 3000 so shipping is 200");
  assert.equal(fixedCouponResult.pricing.grandTotal, 2500, "Grand total: 2800 - 500 + 200 = 2500");
  console.log("✓ Fixed discount coupon verified");

  // 7. Discount Clamping (Discount Cannot Exceed Subtotal)
  console.log("7. Testing Discount Clamping Boundary (Discount > Subtotal)...");
  const excessDiscountResult = calculateCartTotals(
    [{ unitPrice: 300, quantity: 1 }],
    [{ code: "OVERKILL", discountType: "fixed", discountValue: 1000, minOrderAmount: 100 }],
  );
  assert.equal(excessDiscountResult.pricing.subtotal, 300);
  assert.equal(excessDiscountResult.pricing.discountTotal, 300, "Discount must be clamped to subtotal (300)");
  assert.equal(excessDiscountResult.pricing.grandTotal, 200, "Grand total: 300 - 300 + 200 shipping = 200");
  console.log("✓ Excessive discount clamped cleanly without negative price");

  // 8. Direct Coupon Evaluation Unit Tests
  console.log("8. Testing calculateCouponDiscount unit edge cases...");
  const promo = VALID_PROMOTIONS.VIP20!;
  const validVip = calculateCouponDiscount(promo, 6000);
  assert.equal(validVip.isValid, true);
  assert.equal(validVip.appliedAmount, 1200, "20% of 6000 is 1200");

  const invalidVip = calculateCouponDiscount(promo, 4999);
  assert.equal(invalidVip.isValid, false);
  assert.equal(invalidVip.appliedAmount, 0);
  assert.match(invalidVip.reason || "", /Minimum order amount/, "Reason should state minimum order amount required");
  console.log("✓ Coupon unit evaluation edge cases verified");

  console.log("\n=======================================================");
  console.log(" All 8 Cart Pricing & SQA Test Cases Passed Successfully! ");
  console.log("=======================================================\n");
}

runCartPricingTests().catch((err) => {
  console.error("Cart pricing test failed:", err);
  process.exit(1);
});
