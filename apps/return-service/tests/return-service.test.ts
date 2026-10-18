/**
 * return-service unit & integration test suite
 *
 * Run with:  pnpm --filter return-service test
 *   (resolves to: tsx tests/return-service.test.ts)
 *
 * Following the monorepo convention: no Vitest/Jest — pure Node assert.
 */
import assert from "assert";

// ─── Test: ProrationService ────────────────────────────────────────────────────
import { ProrationService } from "../src/services/proration.service.js";

const prorationService = new ProrationService();

async function testProration() {
  console.log("1. ProrationService.calculateProratedRefund ...");

  // Simple case: returning 1 of 2 items, with a discount and tax
  const result = prorationService.calculateProratedRefund([
    {
      orderItemId: "item-1",
      productId: "prod-1",
      returnedQuantity: 1,
      originalQuantity: 2,
      unitPrice: "50.00",
      itemDiscount: "10.00", // total order-level discount across 2 units → 5 per unit
      taxAmount: "8.00",     // total tax across 2 units → 4 per unit
      reason: "DEFECTIVE",
      condition: "UNOPENED",
    },
  ]);

  // Subtotal: 50 - 5 (prorated discount) = 45
  assert.equal(result.subtotalRefund, "45.00", "subtotal should be 45.00");
  // Tax: 4.00 (prorated)
  assert.equal(result.taxRefund, "4.00", "tax refund should be 4.00");
  // Total: 45 + 4 = 49
  assert.equal(result.totalRefund, "49.00", "total refund should be 49.00");
  assert.equal(result.shippingDeduction, "0.00", "no shipping deduction by default");

  console.log("  ✓ single item proration");

  // Partial quantity return — 2 of 5 units
  const r2 = prorationService.calculateProratedRefund([
    {
      orderItemId: "item-2",
      productId: "prod-2",
      returnedQuantity: 2,
      originalQuantity: 5,
      unitPrice: "20.00",
      itemDiscount: "0.00",
      taxAmount: "0.00",
      reason: "CHANGED_MIND",
      condition: "UNOPENED",
    },
  ]);
  // 2 * 20 = 40
  assert.equal(r2.subtotalRefund, "40.00", "partial qty subtotal should be 40.00");
  assert.equal(r2.totalRefund, "40.00");

  console.log("  ✓ partial quantity return");

  // With shipping deduction
  const r3 = prorationService.calculateProratedRefund(
    [
      {
        orderItemId: "item-3",
        productId: "prod-3",
        returnedQuantity: 1,
        originalQuantity: 1,
        unitPrice: "100.00",
        itemDiscount: "0.00",
        taxAmount: "0.00",
        reason: "CHANGED_MIND",
        condition: "UNOPENED",
      },
    ],
    "5.99",
  );
  assert.equal(r3.totalRefund, "94.01");
  assert.equal(r3.shippingDeduction, "5.99");
  console.log("  ✓ shipping deduction applied");

  // Zero-protection: negative total should floor to 0
  const r4 = prorationService.calculateProratedRefund(
    [
      {
        orderItemId: "item-4",
        productId: "prod-4",
        returnedQuantity: 1,
        originalQuantity: 1,
        unitPrice: "3.00",
        itemDiscount: "0.00",
        taxAmount: "0.00",
        reason: "CHANGED_MIND",
        condition: "OPENED",
      },
    ],
    "10.00", // bigger deduction than subtotal
  );
  assert.equal(r4.totalRefund, "0.00", "total should floor to 0 when deduction > subtotal");
  console.log("  ✓ negative total floors to 0.00");

  console.log("  ✓ ProrationService: all cases passed\n");
}

// ─── Test: ReturnStateMachine ──────────────────────────────────────────────────
import { ReturnStateMachine } from "../src/services/state-machine.js";
import { ReturnStatusEnum } from "@repo/types";

async function testStateMachine() {
  console.log("2. ReturnStateMachine transitions ...");

  // Valid forward transitions
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.REQUESTED, ReturnStatusEnum.APPROVED), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.APPROVED, ReturnStatusEnum.AWAITING_RETURN_SHIPMENT), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.IN_TRANSIT, ReturnStatusEnum.RECEIVED), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.RECEIVED, ReturnStatusEnum.INSPECTION), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.INSPECTION, ReturnStatusEnum.REFUND_PENDING), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.REFUND_PENDING, ReturnStatusEnum.COMPLETED), true);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.REFUND_FAILED, ReturnStatusEnum.REFUND_PENDING), true);

  // Invalid / backwards transitions
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.COMPLETED, ReturnStatusEnum.REQUESTED), false);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.REJECTED, ReturnStatusEnum.APPROVED), false);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.CANCELLED, ReturnStatusEnum.IN_TRANSIT), false);
  assert.equal(ReturnStateMachine.canTransition(ReturnStatusEnum.REFUND_PENDING, ReturnStatusEnum.REQUESTED), false);
  console.log("  ✓ valid transitions accepted");

  // assertTransition throws on invalid
  assert.throws(
    () => ReturnStateMachine.assertTransition(ReturnStatusEnum.COMPLETED, ReturnStatusEnum.REQUESTED),
    /Invalid return state transition/,
  );
  console.log("  ✓ assertTransition throws on invalid");

  // Terminal state check
  assert.equal(ReturnStateMachine.isTerminalState(ReturnStatusEnum.COMPLETED), true);
  assert.equal(ReturnStateMachine.isTerminalState(ReturnStatusEnum.REJECTED), true);
  assert.equal(ReturnStateMachine.isTerminalState(ReturnStatusEnum.CANCELLED), true);
  assert.equal(ReturnStateMachine.isTerminalState(ReturnStatusEnum.REFUND_PENDING), false);
  console.log("  ✓ isTerminalState correct\n");
}

// ─── Test: @repo/types contract schemas ───────────────────────────────────────
import {
  CreateReturnRequestSchema,
  ReturnReasonEnum,
  ReturnItemConditionEnum,
  ReturnInspectionDispositionEnum,
  RecordInspectionSchema,
  ReturnEvidenceSchema,
  SubmitReturnTrackingSchema,
} from "@repo/types";

async function testSchemas() {
  console.log("3. @repo/types schema validation ...");

  // Valid request
  const good = CreateReturnRequestSchema.safeParse({
    orderId: "order-abc",
    items: [
      {
        orderItemId: "oi-1",
        productId: "prod-1",
        quantity: 1,
        reason: ReturnReasonEnum.DEFECTIVE,
      },
    ],
    reasonCategory: ReturnReasonEnum.DEFECTIVE,
  });
  assert.equal(good.success, true, "valid request must parse");

  // At least 1 item required
  const bad = CreateReturnRequestSchema.safeParse({
    orderId: "order-abc",
    items: [],
    reasonCategory: ReturnReasonEnum.DEFECTIVE,
  });
  assert.equal(bad.success, false, "empty items must be rejected");
  console.log("  ✓ CreateReturnRequestSchema");

  // RecordInspectionSchema
  const inspection = RecordInspectionSchema.safeParse({
    returnId: "ret-1",
    inspectorId: "insp-1",
    overallCondition: "DAMAGED",
    items: [
      {
        returnItemId: "ri-1",
        receivedCondition: ReturnItemConditionEnum.DEFECTIVE,
        disposition: ReturnInspectionDispositionEnum.DAMAGED_SCRAP,
      },
    ],
  });
  assert.equal(inspection.success, true, "valid inspection must parse");
  console.log("  ✓ RecordInspectionSchema");

  // ReturnEvidenceSchema
  const evidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-abc-123",
    url: "https://cdn.larekmart.com/returns/photo.jpg",
  });
  assert.equal(evidence.success, true, "valid evidence must parse");

  const badEvidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-abc",
    url: "not-a-url",
  });
  assert.equal(badEvidence.success, false, "invalid URL must be rejected");
  console.log("  ✓ ReturnEvidenceSchema");

  // SubmitReturnTrackingSchema
  const tracking = SubmitReturnTrackingSchema.safeParse({
    returnId: "ret-1",
    carrierName: "TCS",
    trackingNumber: "TCS-12345678",
  });
  assert.equal(tracking.success, true, "valid tracking must parse");
  console.log("  ✓ SubmitReturnTrackingSchema\n");
}

// ─── Runner ───────────────────────────────────────────────────────────────────
async function run() {
  console.log("=== return-service test suite ===\n");
  await testProration();
  await testStateMachine();
  await testSchemas();
  console.log("==========================================");
  console.log(" All return-service tests passed! ✓");
  console.log("==========================================");
}

run().catch((err) => {
  console.error("\n✗ Test failure:", err);
  process.exit(1);
});
