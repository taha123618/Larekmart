import assert from "assert";
import {
  ReturnStatusEnum,
  ReturnStatusSchema,
  ReturnReasonEnum,
  ReturnReasonSchema,
  ReturnItemConditionEnum,
  ReturnItemConditionSchema,
  ReturnInspectionDispositionEnum,
  ReturnInspectionDispositionSchema,
  ReturnRefundStatusEnum,
  ReturnRefundStatusSchema,
  ReturnItemSchema,
  CreateReturnRequestSchema,
  AdminApproveReturnSchema,
  AdminRejectReturnSchema,
  RecordInspectionSchema,
  ReturnEvidenceSchema,
  ReturnStateTransitionSchema,
  ReturnRequestedPayloadSchema,
  ReturnApprovedPayloadSchema,
  ReturnRejectedPayloadSchema,
  ReturnShipmentRequestedPayloadSchema,
  ReturnReceivedPayloadSchema,
  ReturnInspectionCompletedPayloadSchema,
  ReturnRefundRequestedPayloadSchema,
  ReturnCompletedPayloadSchema,
  ReturnCancelledPayloadSchema,
} from "../src/index.js";

async function runReturnContractTests() {
  console.log("=== Return Service Domain Contracts Test Suite ===\n");

  // 1. Enums
  console.log("1. Testing Return Status & Reason Enums...");
  assert.equal(ReturnStatusEnum.REQUESTED, "REQUESTED");
  assert.equal(ReturnStatusEnum.APPROVED, "APPROVED");
  assert.equal(
    ReturnStatusEnum.AWAITING_RETURN_SHIPMENT,
    "AWAITING_RETURN_SHIPMENT",
  );
  assert.equal(ReturnStatusEnum.IN_TRANSIT, "IN_TRANSIT");
  assert.equal(ReturnStatusEnum.RECEIVED, "RECEIVED");
  assert.equal(ReturnStatusEnum.INSPECTION, "INSPECTION");
  assert.equal(ReturnStatusEnum.REFUND_PENDING, "REFUND_PENDING");
  assert.equal(ReturnStatusEnum.COMPLETED, "COMPLETED");
  assert.equal(ReturnStatusEnum.REJECTED, "REJECTED");
  assert.equal(ReturnStatusEnum.CANCELLED, "CANCELLED");

  assert.equal(ReturnReasonEnum.DAMAGED_TRANSIT, "DAMAGED_TRANSIT");
  assert.equal(ReturnReasonEnum.DEFECTIVE, "DEFECTIVE");
  assert.equal(ReturnReasonEnum.CHANGED_MIND, "CHANGED_MIND");
  console.log("✓ Enums verified");

  // 2. ReturnItemSchema
  console.log("2. Testing ReturnItemSchema...");
  const validItem = {
    orderItemId: "item-123",
    productId: "prod-456",
    variantId: "var-789",
    quantity: 2,
    reason: ReturnReasonEnum.DEFECTIVE,
    condition: ReturnItemConditionEnum.UNOPENED,
    customerNote: "Device did not power on",
  };
  const parsedItem = ReturnItemSchema.safeParse(validItem);
  assert.equal(parsedItem.success, true, "Valid return item should parse");
  console.log("✓ ReturnItemSchema validated");

  // 3. CreateReturnRequestSchema
  console.log("3. Testing CreateReturnRequestSchema...");
  const validRequest = {
    orderId: "order-999",
    items: [validItem],
    evidenceMediaIds: ["asset-abc-123"],
    reasonCategory: ReturnReasonEnum.DEFECTIVE,
    customerComments: "Package arrived damaged, unit dead",
  };
  const parsedReq = CreateReturnRequestSchema.safeParse(validRequest);
  assert.equal(
    parsedReq.success,
    true,
    "Valid create return request should parse",
  );

  const invalidReq = {
    orderId: "order-999",
    items: [], // At least 1 item required
  };
  const invalidResult = CreateReturnRequestSchema.safeParse(invalidReq);
  assert.equal(invalidResult.success, false, "Empty items must be rejected");
  console.log("✓ CreateReturnRequestSchema validated");

  // 4. AdminApproveReturnSchema & AdminRejectReturnSchema
  console.log("4. Testing Admin Approve and Reject Schemas...");
  const validApprove = {
    returnId: "ret-123",
    sellerId: "seller-456",
    reviewerRole: "ADMIN",
    notes: "Approved under standard warranty",
    providePrepaidLabel: true,
  };
  assert.equal(AdminApproveReturnSchema.safeParse(validApprove).success, true);

  const validReject = {
    returnId: "ret-123",
    sellerId: "seller-456",
    reviewerRole: "SELLER",
    rejectionReason: "Policy window exceeded and no evidence provided",
  };
  assert.equal(AdminRejectReturnSchema.safeParse(validReject).success, true);
  console.log("✓ Admin approve/reject schemas validated");

  // 5. RecordInspectionSchema
  console.log("5. Testing RecordInspectionSchema...");
  const validInspection = {
    returnId: "ret-123",
    inspectorId: "insp-001",
    overallCondition: "DEFECTIVE",
    items: [
      {
        returnItemId: "item-123",
        receivedCondition: ReturnItemConditionEnum.DEFECTIVE,
        disposition: ReturnInspectionDispositionEnum.DAMAGED_SCRAP,
        notes: "Power circuit fried",
      },
    ],
    notes: "Inspection complete, scrap item",
  };
  assert.equal(RecordInspectionSchema.safeParse(validInspection).success, true);
  console.log("✓ RecordInspectionSchema validated");

  // 6. Kafka Event Schemas
  console.log("6. Testing Kafka Event Payload Schemas...");
  const returnRequestedPayload = {
    returnId: "ret-123",
    orderId: "order-999",
    customerId: "cust-123",
    sellerId: "seller-456",
    status: ReturnStatusEnum.REQUESTED,
    items: [
      {
        orderItemId: "item-123",
        productId: "prod-456",
        quantity: 2,
        reason: ReturnReasonEnum.DEFECTIVE,
      },
    ],
    requestedAt: new Date().toISOString(),
  };
  assert.equal(
    ReturnRequestedPayloadSchema.safeParse(returnRequestedPayload).success,
    true,
  );

  const returnInspectionCompletedPayload = {
    returnId: "ret-123",
    orderId: "order-999",
    customerId: "cust-123",
    sellerId: "seller-456",
    inspectorId: "insp-001",
    disposition: ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
    restockableItems: [
      {
        productId: "prod-456",
        quantity: 2,
      },
    ],
    inspectedAt: new Date().toISOString(),
  };
  assert.equal(
    ReturnInspectionCompletedPayloadSchema.safeParse(
      returnInspectionCompletedPayload,
    ).success,
    true,
  );

  const returnRefundRequestedPayload = {
    returnId: "ret-123",
    orderId: "order-999",
    customerId: "cust-123",
    paymentIntentId: "pi_12345",
    idempotencyKey: "idem-ret-123-refund",
    subtotalRefund: "100.00",
    taxRefund: "10.00",
    shippingDeduction: "0.00",
    totalRefund: "110.00",
    currency: "USD",
    requestedAt: new Date().toISOString(),
  };
  assert.equal(
    ReturnRefundRequestedPayloadSchema.safeParse(returnRefundRequestedPayload)
      .success,
    true,
  );
  console.log("✓ Kafka event payload schemas validated");

  console.log("\n==================================================");
  console.log(" All Return Service Domain Contract Tests Passed! ");
  console.log("==================================================");
}

runReturnContractTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
