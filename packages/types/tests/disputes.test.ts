import assert from "node:assert/strict";
import {
  DisputeStatusEnum,
  DisputeStatusSchema,
  DisputeTypeEnum,
  DisputeTypeSchema,
  DisputeResolutionEnum,
  DisputeResolutionSchema,
  CreateDisputeSchema,
  SubmitRebuttalSchema,
  ResolveDisputeSchema,
  DisputeResponseSchema,
  DisputesOverviewSchema,
} from "../src/disputes";

console.log("=== Marketplace Dispute Contracts & Zod Schemas Test Suite ===");

// 1. Enum validation
console.log("\n[Test 1] Dispute Lifecycle & Type Enums");
assert.equal(DisputeStatusSchema.parse("OPENED"), DisputeStatusEnum.OPENED);
assert.equal(
  DisputeStatusSchema.parse("EVIDENCE_REQUESTED"),
  DisputeStatusEnum.EVIDENCE_REQUESTED,
);
assert.equal(
  DisputeStatusSchema.parse("EVIDENCE_SUBMITTED"),
  DisputeStatusEnum.EVIDENCE_SUBMITTED,
);
assert.equal(
  DisputeStatusSchema.parse("ARBITRATION"),
  DisputeStatusEnum.ARBITRATION,
);
assert.equal(
  DisputeStatusSchema.parse("RESOLVED_BUYER_FAVOR"),
  DisputeStatusEnum.RESOLVED_BUYER_FAVOR,
);
assert.equal(
  DisputeStatusSchema.parse("RESOLVED_SELLER_FAVOR"),
  DisputeStatusEnum.RESOLVED_SELLER_FAVOR,
);
assert.equal(
  DisputeStatusSchema.parse("CANCELLED"),
  DisputeStatusEnum.CANCELLED,
);
assert.throws(() => DisputeStatusSchema.parse("UNKNOWN_STATUS"));

assert.equal(
  DisputeTypeSchema.parse("ITEM_NOT_RECEIVED"),
  DisputeTypeEnum.ITEM_NOT_RECEIVED,
);
assert.equal(
  DisputeTypeSchema.parse("DAMAGED_OR_DEFECTIVE"),
  DisputeTypeEnum.DAMAGED_OR_DEFECTIVE,
);
assert.equal(
  DisputeTypeSchema.parse("STRIPE_CHARGEBACK"),
  DisputeTypeEnum.STRIPE_CHARGEBACK,
);
assert.throws(() => DisputeTypeSchema.parse("INVALID_TYPE"));

assert.equal(
  DisputeResolutionSchema.parse("BUYER_FAVOR"),
  DisputeResolutionEnum.BUYER_FAVOR,
);
assert.equal(
  DisputeResolutionSchema.parse("SELLER_FAVOR"),
  DisputeResolutionEnum.SELLER_FAVOR,
);
console.log(
  "  ✓ All dispute status, type, and resolution enums strictly validated",
);

// 2. CreateDisputeSchema validation
console.log("\n[Test 2] CreateDisputeSchema Invariants");
const validCreate = CreateDisputeSchema.parse({
  orderId: "ord_10029",
  vendorId: "vnd_9921",
  type: "ITEM_NOT_RECEIVED",
  disputedAmount: 4999.5,
  buyerClaim:
    "Package was marked as delivered yesterday, but security cameras confirm no courier arrived.",
  buyerEvidenceUrls: ["https://s3.larekmart.com/disputes/cctv_footage.png"],
});
assert.equal(validCreate.orderId, "ord_10029");
assert.equal(validCreate.currency, "PKR");
assert.equal(validCreate.disputedAmount, 4999.5);

// Edge case: empty claim or negative amount
assert.throws(() =>
  CreateDisputeSchema.parse({
    orderId: "ord_10029",
    vendorId: "vnd_9921",
    type: "ITEM_NOT_RECEIVED",
    disputedAmount: -10, // Invalid negative
    buyerClaim: "Short", // Too short
  }),
);
console.log(
  "  ✓ CreateDisputeSchema validates fields and rejects invalid boundaries",
);

// 3. SubmitRebuttalSchema validation
console.log("\n[Test 3] SubmitRebuttalSchema Invariants");
const validRebuttal = SubmitRebuttalSchema.parse({
  sellerRebuttal:
    "TCS tracking number 7721832 confirms signature and delivery directly to customer doorstep.",
  sellerEvidenceUrls: [
    "https://s3.larekmart.com/disputes/tcs_proof_of_delivery.pdf",
    "https://s3.larekmart.com/disputes/signed_receipt.jpg",
  ],
});
assert.equal(validRebuttal.sellerEvidenceUrls.length, 2);

// Rebuttal requires at least 1 evidence URL
assert.throws(() =>
  SubmitRebuttalSchema.parse({
    sellerRebuttal: "I delivered it honestly.",
    sellerEvidenceUrls: [], // Must have evidence
  }),
);
console.log("  ✓ SubmitRebuttalSchema requires explanation and proof URLs");

// 4. ResolveDisputeSchema validation
console.log("\n[Test 4] ResolveDisputeSchema Invariants");
const validResolve = ResolveDisputeSchema.parse({
  resolution: "BUYER_FAVOR",
  resolutionReason:
    "Courier confirmed tracking was marked delivered in error at wrong street address.",
  clawbackEscrow: true,
});
assert.equal(validResolve.resolution, "BUYER_FAVOR");
assert.equal(validResolve.clawbackEscrow, true);
console.log("  ✓ ResolveDisputeSchema enforces resolution rationale");

// 5. DisputeResponseSchema and Overview Schema
console.log("\n[Test 5] DisputeResponseSchema & DisputesOverviewSchema");
const now = new Date().toISOString();
const sampleDispute = DisputeResponseSchema.parse({
  id: "dsp_12345",
  disputeNumber: "DSP-2026-0001",
  orderId: "ord_10029",
  vendorId: "vnd_9921",
  buyerId: "user_buyer_99",
  buyerEmail: "buyer@example.com",
  type: "ITEM_NOT_RECEIVED",
  status: "OPENED",
  disputedAmount: 4999.5,
  currency: "PKR",
  buyerClaim: "Package was not received at designated shipping address.",
  buyerEvidenceUrls: [],
  sellerEvidenceUrls: [],
  createdAt: now,
  updatedAt: now,
  timeline: [
    {
      id: "tl_1",
      disputeId: "dsp_12345",
      action: "DISPUTE_OPENED",
      performedBy: "user_buyer_99",
      notes: "Claim initiated",
      createdAt: now,
    },
  ],
});
assert.equal(sampleDispute.disputeNumber, "DSP-2026-0001");
assert.equal(sampleDispute.timeline?.length, 1);

const overview = DisputesOverviewSchema.parse({
  totalDisputes: 15,
  openCount: 5,
  underReviewCount: 3,
  evidenceRequestedCount: 2,
  arbitrationCount: 2,
  resolvedCount: 3,
  totalDisputedAmount: 125000,
});
assert.equal(overview.totalDisputes, 15);
console.log("  ✓ DisputeResponseSchema and DisputesOverviewSchema verified");

console.log("\n=======================================================");
console.log(" All Dispute Domain Contracts Passed Successfully! 🎉 ");
console.log("=======================================================\n");
