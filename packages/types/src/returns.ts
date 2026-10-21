import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const ReturnStatusEnum = {
  REQUESTED: "REQUESTED",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  AWAITING_RETURN_SHIPMENT: "AWAITING_RETURN_SHIPMENT",
  IN_TRANSIT: "IN_TRANSIT",
  RECEIVED: "RECEIVED",
  INSPECTION: "INSPECTION",
  DISPUTED: "DISPUTED",
  REFUND_PENDING: "REFUND_PENDING",
  COMPLETED: "COMPLETED",
  REFUND_FAILED: "REFUND_FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type ReturnStatus =
  (typeof ReturnStatusEnum)[keyof typeof ReturnStatusEnum];

export const ReturnStatusSchema = z.nativeEnum(ReturnStatusEnum);

export const ReturnReasonEnum = {
  DAMAGED_TRANSIT: "DAMAGED_TRANSIT",
  DEFECTIVE: "DEFECTIVE",
  WRONG_ITEM: "WRONG_ITEM",
  NOT_AS_DESCRIBED: "NOT_AS_DESCRIBED",
  CHANGED_MIND: "CHANGED_MIND",
  SIZE_MISMATCH: "SIZE_MISMATCH",
  ARRIVED_LATE: "ARRIVED_LATE",
  OTHER: "OTHER",
} as const;

export type ReturnReason =
  (typeof ReturnReasonEnum)[keyof typeof ReturnReasonEnum];

export const ReturnReasonSchema = z.nativeEnum(ReturnReasonEnum);

export const ReturnItemConditionEnum = {
  UNOPENED: "UNOPENED",
  OPEN_BOX: "OPEN_BOX",
  DAMAGED: "DAMAGED",
  DEFECTIVE: "DEFECTIVE",
  MISSING_PARTS: "MISSING_PARTS",
} as const;

export type ReturnItemCondition =
  (typeof ReturnItemConditionEnum)[keyof typeof ReturnItemConditionEnum];

export const ReturnItemConditionSchema = z.nativeEnum(ReturnItemConditionEnum);

export const ReturnInspectionDispositionEnum = {
  RESTOCK_SELLABLE: "RESTOCK_SELLABLE",
  RESTOCK_REFURBISHED: "RESTOCK_REFURBISHED",
  DAMAGED_SCRAP: "DAMAGED_SCRAP",
  RETURN_TO_VENDOR: "RETURN_TO_VENDOR",
} as const;

export type ReturnInspectionDisposition =
  (typeof ReturnInspectionDispositionEnum)[keyof typeof ReturnInspectionDispositionEnum];

export const ReturnInspectionDispositionSchema = z.nativeEnum(
  ReturnInspectionDispositionEnum,
);

export const ReturnRefundStatusEnum = {
  PENDING: "PENDING",
  REQUESTED: "REQUESTED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type ReturnRefundStatus =
  (typeof ReturnRefundStatusEnum)[keyof typeof ReturnRefundStatusEnum];

export const ReturnRefundStatusSchema = z.nativeEnum(ReturnRefundStatusEnum);

// ============================================================================
// Schemas
// ============================================================================

export const ReturnItemSchema = z.object({
  orderItemId: z.string().min(1, "Order item ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be positive"),
  reason: ReturnReasonSchema,
  condition: ReturnItemConditionSchema.default(
    ReturnItemConditionEnum.UNOPENED,
  ),
  customerNote: z.string().max(1000).optional(),
});

export type ReturnItem = z.infer<typeof ReturnItemSchema>;

export const CreateReturnRequestSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  sellerId: z.string().optional(),
  items: z.array(ReturnItemSchema).min(1, "At least one item must be returned"),
  evidenceMediaIds: z.array(z.string()).default([]),
  reasonCategory: ReturnReasonSchema,
  customerComments: z.string().max(2000).optional(),
});

export type CreateReturnRequest = z.infer<typeof CreateReturnRequestSchema>;

export const AdminApproveReturnSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  sellerId: z.string().optional(),
  reviewerRole: z.enum(["SELLER", "ADMIN", "SUPPORT"]).default("ADMIN"),
  notes: z.string().max(1000).optional(),
  providePrepaidLabel: z.boolean().default(true),
});

export type AdminApproveReturn = z.infer<typeof AdminApproveReturnSchema>;

export const AdminRejectReturnSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  sellerId: z.string().optional(),
  reviewerRole: z.enum(["SELLER", "ADMIN", "SUPPORT"]).default("ADMIN"),
  rejectionReason: z
    .string()
    .min(5, "Rejection reason must be at least 5 characters"),
});

export type AdminRejectReturn = z.infer<typeof AdminRejectReturnSchema>;

export const InspectedItemSchema = z.object({
  returnItemId: z.string().min(1, "Return item ID is required"),
  receivedCondition: ReturnItemConditionSchema,
  disposition: ReturnInspectionDispositionSchema,
  notes: z.string().max(1000).optional(),
});

export type InspectedItem = z.infer<typeof InspectedItemSchema>;

export const RecordInspectionSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  inspectorId: z.string().min(1, "Inspector ID is required"),
  overallCondition: z
    .string()
    .min(1, "Overall condition description is required"),
  items: z
    .array(InspectedItemSchema)
    .min(1, "At least one item must be inspected"),
  notes: z.string().max(2000).optional(),
});

export type RecordInspection = z.infer<typeof RecordInspectionSchema>;

export const ReturnEvidenceSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  mediaId: z.string().min(1, "Media asset ID is required"),
  url: z.string().url("Must be a valid URL"),
  mediaType: z.enum(["PHOTO", "VIDEO", "DOCUMENT"]).default("PHOTO"),
  caption: z.string().max(500).optional(),
});

export type ReturnEvidence = z.infer<typeof ReturnEvidenceSchema>;

export const ReturnStateTransitionSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  previousState: ReturnStatusSchema,
  newState: ReturnStatusSchema,
  actorId: z.string().min(1, "Actor ID is required"),
  actorRole: z.enum(["CUSTOMER", "SELLER", "ADMIN", "SYSTEM"]),
  reasonNote: z.string().max(1000).optional(),
  timestamp: z.string().datetime().optional(),
});

export type ReturnStateTransition = z.infer<typeof ReturnStateTransitionSchema>;

export const SubmitReturnTrackingSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  carrierName: z.string().min(1, "Carrier name is required"),
  trackingNumber: z
    .string()
    .min(3, "Tracking number must be at least 3 characters"),
});

export type SubmitReturnTracking = z.infer<typeof SubmitReturnTrackingSchema>;

// ============================================================================
// Kafka Event Payload Schemas & Interfaces
// ============================================================================

export const ReturnRequestedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  sellerId: z.string().optional(),
  status: ReturnStatusSchema,
  items: z.array(
    z.object({
      orderItemId: z.string().min(1),
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      reason: ReturnReasonSchema,
    }),
  ),
  requestedAt: z.string(),
});

export type ReturnRequestedPayload = z.infer<
  typeof ReturnRequestedPayloadSchema
>;

export const ReturnApprovedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  sellerId: z.string().optional(),
  approvedBy: z.string().min(1),
  approvedRole: z.string().min(1),
  providePrepaidLabel: z.boolean(),
  approvedAt: z.string(),
});

export type ReturnApprovedPayload = z.infer<typeof ReturnApprovedPayloadSchema>;

export const ReturnRejectedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  rejectedBy: z.string().min(1),
  rejectionReason: z.string().min(1),
  rejectedAt: z.string(),
});

export type ReturnRejectedPayload = z.infer<typeof ReturnRejectedPayloadSchema>;

export const ReturnShipmentRequestedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  sellerId: z.string().optional(),
  prepaidBySeller: z.boolean(),
  requestedAt: z.string(),
});

export type ReturnShipmentRequestedPayload = z.infer<
  typeof ReturnShipmentRequestedPayloadSchema
>;

export const ReturnReceivedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  carrierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  receivedAt: z.string(),
});

export type ReturnReceivedPayload = z.infer<typeof ReturnReceivedPayloadSchema>;

export const ReturnInspectionCompletedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  sellerId: z.string().optional(),
  inspectorId: z.string().min(1),
  disposition: ReturnInspectionDispositionSchema,
  restockableItems: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
  inspectedAt: z.string(),
});

export type ReturnInspectionCompletedPayload = z.infer<
  typeof ReturnInspectionCompletedPayloadSchema
>;

export const ReturnRefundRequestedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  paymentIntentId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  subtotalRefund: z.string(),
  taxRefund: z.string(),
  shippingDeduction: z.string(),
  totalRefund: z.string(),
  currency: z.string(),
  requestedAt: z.string(),
});

export type ReturnRefundRequestedPayload = z.infer<
  typeof ReturnRefundRequestedPayloadSchema
>;

export const ReturnCompletedPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  totalRefund: z.string(),
  currency: z.string(),
  completedAt: z.string(),
});

export type ReturnCompletedPayload = z.infer<
  typeof ReturnCompletedPayloadSchema
>;

export const ReturnCancelledPayloadSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  cancelledBy: z.string().min(1),
  cancelReason: z.string().optional(),
  cancelledAt: z.string(),
});

export type ReturnCancelledPayload = z.infer<
  typeof ReturnCancelledPayloadSchema
>;
