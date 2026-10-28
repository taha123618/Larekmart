import { z } from "zod";

// ==============================================================================
// 1. Dispute Enums
// ==============================================================================

export const DisputeStatusEnum = {
  OPENED: "OPENED",
  UNDER_REVIEW: "UNDER_REVIEW",
  EVIDENCE_REQUESTED: "EVIDENCE_REQUESTED",
  EVIDENCE_SUBMITTED: "EVIDENCE_SUBMITTED",
  ARBITRATION: "ARBITRATION",
  RESOLVED_BUYER_FAVOR: "RESOLVED_BUYER_FAVOR",
  RESOLVED_SELLER_FAVOR: "RESOLVED_SELLER_FAVOR",
  CANCELLED: "CANCELLED",
} as const;

export type DisputeStatus =
  (typeof DisputeStatusEnum)[keyof typeof DisputeStatusEnum];

export const DisputeStatusSchema = z.enum([
  DisputeStatusEnum.OPENED,
  DisputeStatusEnum.UNDER_REVIEW,
  DisputeStatusEnum.EVIDENCE_REQUESTED,
  DisputeStatusEnum.EVIDENCE_SUBMITTED,
  DisputeStatusEnum.ARBITRATION,
  DisputeStatusEnum.RESOLVED_BUYER_FAVOR,
  DisputeStatusEnum.RESOLVED_SELLER_FAVOR,
  DisputeStatusEnum.CANCELLED,
]);

export const DisputeTypeEnum = {
  ITEM_NOT_RECEIVED: "ITEM_NOT_RECEIVED",
  DAMAGED_OR_DEFECTIVE: "DAMAGED_OR_DEFECTIVE",
  SIGNIFICANTLY_NOT_AS_DESCRIBED: "SIGNIFICANTLY_NOT_AS_DESCRIBED",
  WRONG_ITEM_SENT: "WRONG_ITEM_SENT",
  STRIPE_CHARGEBACK: "STRIPE_CHARGEBACK",
  UNAUTHORIZED_TRANSACTION: "UNAUTHORIZED_TRANSACTION",
} as const;

export type DisputeType = (typeof DisputeTypeEnum)[keyof typeof DisputeTypeEnum];

export const DisputeTypeSchema = z.enum([
  DisputeTypeEnum.ITEM_NOT_RECEIVED,
  DisputeTypeEnum.DAMAGED_OR_DEFECTIVE,
  DisputeTypeEnum.SIGNIFICANTLY_NOT_AS_DESCRIBED,
  DisputeTypeEnum.WRONG_ITEM_SENT,
  DisputeTypeEnum.STRIPE_CHARGEBACK,
  DisputeTypeEnum.UNAUTHORIZED_TRANSACTION,
]);

export const DisputeResolutionEnum = {
  BUYER_FAVOR: "BUYER_FAVOR",
  SELLER_FAVOR: "SELLER_FAVOR",
  MUTUAL_AGREEMENT: "MUTUAL_AGREEMENT",
} as const;

export type DisputeResolution =
  (typeof DisputeResolutionEnum)[keyof typeof DisputeResolutionEnum];

export const DisputeResolutionSchema = z.enum([
  DisputeResolutionEnum.BUYER_FAVOR,
  DisputeResolutionEnum.SELLER_FAVOR,
  DisputeResolutionEnum.MUTUAL_AGREEMENT,
]);

// ==============================================================================
// 2. Request & Form Schemas
// ==============================================================================

export const CreateDisputeSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  orderItemId: z.string().optional().nullable(),
  vendorId: z.string().min(1, "Vendor ID is required"),
  type: DisputeTypeSchema,
  disputedAmount: z.number().positive("Disputed amount must be greater than zero"),
  currency: z.string().length(3).default("PKR"),
  buyerClaim: z
    .string()
    .min(10, "Please provide at least 10 characters detailing your claim")
    .max(2000, "Claim text cannot exceed 2000 characters"),
  buyerEvidenceUrls: z.array(z.string().url()).default([]),
  stripeDisputeId: z.string().optional().nullable(),
});

export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>;

export const SubmitRebuttalSchema = z.object({
  sellerRebuttal: z
    .string()
    .min(10, "Please provide at least 10 characters detailing your rebuttal defense")
    .max(2000, "Rebuttal text cannot exceed 2000 characters"),
  sellerEvidenceUrls: z
    .array(z.string().url())
    .min(1, "At least 1 piece of supporting evidence or tracking document is required"),
});

export type SubmitRebuttalInput = z.infer<typeof SubmitRebuttalSchema>;

export const ResolveDisputeSchema = z.object({
  resolution: DisputeResolutionSchema,
  resolutionReason: z
    .string()
    .min(5, "Resolution reason must be at least 5 characters")
    .max(1000, "Resolution reason cannot exceed 1000 characters"),
  clawbackEscrow: z.boolean().default(true),
});

export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

// ==============================================================================
// 3. Response & Timeline Schemas
// ==============================================================================

export const DisputeTimelineEntrySchema = z.object({
  id: z.string(),
  disputeId: z.string(),
  action: z.string(),
  performedBy: z.string(),
  notes: z.string().optional().nullable(),
  createdAt: z.union([z.string(), z.date()]),
});

export type DisputeTimelineEntry = z.infer<typeof DisputeTimelineEntrySchema>;

export const DisputeResponseSchema = z.object({
  id: z.string(),
  disputeNumber: z.string(),
  orderId: z.string(),
  orderItemId: z.string().optional().nullable(),
  vendorId: z.string(),
  buyerId: z.string(),
  buyerEmail: z.string().optional().nullable(),
  escrowLedgerId: z.string().optional().nullable(),
  stripeDisputeId: z.string().optional().nullable(),
  type: DisputeTypeSchema,
  status: DisputeStatusSchema,
  disputedAmount: z.number(),
  currency: z.string().default("PKR"),
  buyerClaim: z.string(),
  buyerEvidenceUrls: z.array(z.string()).default([]),
  sellerRebuttal: z.string().optional().nullable(),
  sellerEvidenceUrls: z.array(z.string()).default([]),
  rebuttalDeadline: z.union([z.string(), z.date()]).optional().nullable(),
  resolution: DisputeResolutionSchema.optional().nullable(),
  resolutionReason: z.string().optional().nullable(),
  resolvedByAdminId: z.string().optional().nullable(),
  resolvedAt: z.union([z.string(), z.date()]).optional().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  timeline: z.array(DisputeTimelineEntrySchema).optional(),
});

export type DisputeResponse = z.infer<typeof DisputeResponseSchema>;

export const DisputesOverviewSchema = z.object({
  totalDisputes: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  underReviewCount: z.number().int().nonnegative(),
  evidenceRequestedCount: z.number().int().nonnegative(),
  arbitrationCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  totalDisputedAmount: z.number().nonnegative(),
});

export type DisputesOverview = z.infer<typeof DisputesOverviewSchema>;

// ==============================================================================
// 4. Kafka Event Schemas
// ==============================================================================

export const DisputeCreatedEventSchema = z.object({
  disputeId: z.string(),
  disputeNumber: z.string(),
  orderId: z.string(),
  vendorId: z.string(),
  buyerId: z.string(),
  disputedAmount: z.number(),
  currency: z.string(),
  type: DisputeTypeSchema,
  timestamp: z.string(),
});

export type DisputeCreatedEvent = z.infer<typeof DisputeCreatedEventSchema>;

export const DisputeResolvedEventSchema = z.object({
  disputeId: z.string(),
  disputeNumber: z.string(),
  orderId: z.string(),
  vendorId: z.string(),
  resolution: DisputeResolutionSchema,
  resolutionReason: z.string(),
  resolvedAt: z.string(),
});

export type DisputeResolvedEvent = z.infer<typeof DisputeResolvedEventSchema>;

export const PaymentDisputeCreatedEventSchema = z.object({
  stripeDisputeId: z.string(),
  chargeId: z.string().optional().nullable(),
  paymentIntentId: z.string().optional().nullable(),
  amount: z.number(),
  currency: z.string(),
  reason: z.string().optional().nullable(),
  status: z.string(),
  timestamp: z.string(),
});

export type PaymentDisputeCreatedEvent = z.infer<
  typeof PaymentDisputeCreatedEventSchema
>;

export const PaymentDisputeClosedEventSchema = z.object({
  stripeDisputeId: z.string(),
  status: z.string(),
  won: z.boolean(),
  timestamp: z.string(),
});

export type PaymentDisputeClosedEvent = z.infer<
  typeof PaymentDisputeClosedEventSchema
>;

