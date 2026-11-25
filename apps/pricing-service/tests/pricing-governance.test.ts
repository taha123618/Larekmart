import assert from "node:assert/strict";
import {
  setPriceFloor,
  validatePriceAgainstFloor,
  createPriceExperiment,
  assignExperimentPrice,
  submitBulkPriceApproval,
  reviewPriceApproval,
} from "../src/services/pricing-governance.service.js";

console.log("=== pricing-service Governance & Experiments Tests ===");

// 1. Price floor & margin guard
setPriceFloor(
  { productId: "prod_1", minPrice: 25, minMarginPercent: 15, currency: "USD" },
  "usr_admin",
);
assert.equal(validatePriceAgainstFloor("prod_1", 20).allowed, false);
assert.equal(validatePriceAgainstFloor("prod_1", 30, 28).allowed, false); // margin < 15%
assert.equal(validatePriceAgainstFloor("prod_1", 40, 25).allowed, true);
console.log("  ✔ Price floor & minimum margin validation verified");

// 2. Price experiments
const exp = createPriceExperiment({
  productId: "prod_1",
  controlPrice: 40,
  variantPrice: 36,
  trafficSplitPercent: 50,
});
const assigned = assignExperimentPrice(exp.experimentId, "user_seed_42");
assert.ok(assigned.price === 40 || assigned.price === 36);
console.log("  ✔ A/B price experiment bucketing verified");

// 3. Bulk pricing & approval workflow
const approval = submitBulkPriceApproval(
  {
    items: [{ productId: "prod_1", currentPrice: 40, proposedPrice: 38 }],
    reason: "Q4 seasonal price match",
  },
  "usr_seller_1",
);
assert.equal(approval.status, "PENDING_APPROVAL");
const reviewed = reviewPriceApproval(approval.requestId, "APPROVED", "usr_admin_1");
assert.equal(reviewed.status, "APPROVED");
console.log("  ✔ Bulk price approval workflow verified");
