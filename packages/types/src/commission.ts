import { z } from "zod";

// ==============================================================================
// 1. Commission Enums & Types
// ==============================================================================

export const CommissionRuleTypeEnum = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
  TIERED: "TIERED",
  HYBRID: "HYBRID",
} as const;

export type CommissionRuleType =
  (typeof CommissionRuleTypeEnum)[keyof typeof CommissionRuleTypeEnum];

export const CommissionRuleTypeSchema = z.enum([
  CommissionRuleTypeEnum.PERCENTAGE,
  CommissionRuleTypeEnum.FIXED,
  CommissionRuleTypeEnum.TIERED,
  CommissionRuleTypeEnum.HYBRID,
]);

export const CommissionScopeEnum = {
  GLOBAL: "GLOBAL",
  SELLER: "SELLER",
  CATEGORY: "CATEGORY",
  PRODUCT: "PRODUCT",
} as const;

export type CommissionScope =
  (typeof CommissionScopeEnum)[keyof typeof CommissionScopeEnum];

export const CommissionScopeSchema = z.enum([
  CommissionScopeEnum.GLOBAL,
  CommissionScopeEnum.SELLER,
  CommissionScopeEnum.CATEGORY,
  CommissionScopeEnum.PRODUCT,
]);

export const CommissionCalculationStatusEnum = {
  QUOTED: "QUOTED",
  ACCRUED: "ACCRUED",
  ADJUSTED: "ADJUSTED",
  REVERSED: "REVERSED",
} as const;

export type CommissionCalculationStatus =
  (typeof CommissionCalculationStatusEnum)[keyof typeof CommissionCalculationStatusEnum];

export const CommissionCalculationStatusSchema = z.enum([
  CommissionCalculationStatusEnum.QUOTED,
  CommissionCalculationStatusEnum.ACCRUED,
  CommissionCalculationStatusEnum.ADJUSTED,
  CommissionCalculationStatusEnum.REVERSED,
]);

export const CommissionAdjustmentTypeEnum = {
  RETURN_REFUND: "RETURN_REFUND",
  CANCELLATION: "CANCELLATION",
  DISPUTE_REVERSAL: "DISPUTE_REVERSAL",
  MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
} as const;

export type CommissionAdjustmentType =
  (typeof CommissionAdjustmentTypeEnum)[keyof typeof CommissionAdjustmentTypeEnum];

export const CommissionAdjustmentTypeSchema = z.enum([
  CommissionAdjustmentTypeEnum.RETURN_REFUND,
  CommissionAdjustmentTypeEnum.CANCELLATION,
  CommissionAdjustmentTypeEnum.DISPUTE_REVERSAL,
  CommissionAdjustmentTypeEnum.MANUAL_OVERRIDE,
]);

// ==============================================================================
// 2. Commission Domain Schemas
// ==============================================================================

export const CommissionRuleSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  ruleType: CommissionRuleTypeSchema,
  scope: CommissionScopeSchema,
  scopeId: z.string().nullable().optional(),
  percentageRate: z.number().min(0).max(100).default(0),
  fixedAmount: z.number().min(0).default(0),
  minCommission: z.number().min(0).nullable().optional(),
  maxCommission: z.number().min(0).nullable().optional(),
  priority: z.number().int().default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type CommissionRuleTypeDefinition = z.infer<typeof CommissionRuleSchema>;

export const CommissionPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  rules: z.array(CommissionRuleSchema).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type CommissionPlanType = z.infer<typeof CommissionPlanSchema>;

export const CommissionRuleVersionSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  version: z.number().int(),
  ruleSnapshot: z.record(z.string(), z.unknown()),
  changedBy: z.string(),
  changeReason: z.string(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export type CommissionRuleVersionType = z.infer<
  typeof CommissionRuleVersionSchema
>;

// ==============================================================================
// 3. Calculation & Quote Contracts
// ==============================================================================

export const CommissionLineItemInputSchema = z.object({
  orderItemId: z.string().min(1),
  productId: z.union([z.number(), z.string()]),
  categoryId: z.string().min(1),
  sellerId: z.string().min(1),
  itemPrice: z.number().min(0),
  quantity: z.number().int().min(1),
});

export type CommissionLineItemInput = z.infer<
  typeof CommissionLineItemInputSchema
>;

export const CommissionQuoteRequestSchema = z.object({
  orderId: z.string().optional(),
  currency: z.string().default("PKR"),
  items: z.array(CommissionLineItemInputSchema).min(1),
});

export type CommissionQuoteRequest = z.infer<
  typeof CommissionQuoteRequestSchema
>;

export const CommissionLineItemResultSchema = z.object({
  orderItemId: z.string(),
  productId: z.string(),
  categoryId: z.string(),
  sellerId: z.string(),
  itemPrice: z.number(),
  quantity: z.number(),
  commissionableAmount: z.number(),
  ruleId: z.string(),
  ruleVersion: z.number(),
  rateApplied: z.number(),
  feeCalculated: z.number(),
  minMaxApplied: z.boolean(),
});

export type CommissionLineItemResult = z.infer<
  typeof CommissionLineItemResultSchema
>;

export const CommissionCalculationSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sellerId: z.string(),
  subtotal: z.number(),
  totalCommission: z.number(),
  netSellerPayout: z.number(),
  currency: z.string(),
  status: CommissionCalculationStatusSchema,
  lineItems: z.array(CommissionLineItemResultSchema),
  calculationSnapshot: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type CommissionCalculationType = z.infer<
  typeof CommissionCalculationSchema
>;

export const CommissionQuoteResponseSchema = z.object({
  orderId: z.string().optional(),
  currency: z.string(),
  totalSubtotal: z.number(),
  totalCommission: z.number(),
  totalNetPayout: z.number(),
  calculationsBySeller: z.array(CommissionCalculationSchema),
});

export type CommissionQuoteResponse = z.infer<
  typeof CommissionQuoteResponseSchema
>;

// ==============================================================================
// 4. Kafka Event Payloads
// ==============================================================================

export const COMMISSION_TOPICS = {
  CALCULATED: "commission.calculated",
  ACCRUED: "commission.accrued",
  ADJUSTED: "commission.adjusted",
  REVERSED: "commission.reversed",
} as const;

export const CommissionCalculatedEventSchema = z.object({
  calculationId: z.string(),
  orderId: z.string(),
  sellerId: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  totalCommission: z.number(),
  netSellerPayout: z.number(),
  lineItems: z.array(CommissionLineItemResultSchema),
  timestamp: z.string().datetime().optional(),
});

export type CommissionCalculatedEvent = z.infer<
  typeof CommissionCalculatedEventSchema
>;

export const CommissionAccruedEventSchema = z.object({
  calculationId: z.string(),
  orderId: z.string(),
  sellerId: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  totalCommission: z.number(),
  netSellerPayout: z.number(),
  timestamp: z.string().datetime().optional(),
});

export type CommissionAccruedEvent = z.infer<
  typeof CommissionAccruedEventSchema
>;

export const CommissionAdjustedEventSchema = z.object({
  adjustmentId: z.string(),
  calculationId: z.string(),
  orderId: z.string(),
  sellerId: z.string(),
  adjustmentType: CommissionAdjustmentTypeSchema,
  amountAdjusted: z.number(),
  remainingCommission: z.number(),
  reason: z.string(),
  timestamp: z.string().datetime().optional(),
});

export type CommissionAdjustedEvent = z.infer<
  typeof CommissionAdjustedEventSchema
>;

export const CommissionReversedEventSchema = z.object({
  calculationId: z.string(),
  orderId: z.string(),
  sellerId: z.string(),
  totalReversedAmount: z.number(),
  reason: z.string(),
  timestamp: z.string().datetime().optional(),
});

export type CommissionReversedEvent = z.infer<
  typeof CommissionReversedEventSchema
>;
