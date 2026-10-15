import { z } from "zod";

/**
 * Common Address Schema for Tax Determination
 */
export const TaxAddressSchema = z.object({
  country: z.string().min(2).max(3).toUpperCase(),
  region: z.string().min(1).max(50).optional(), // State or Province
  city: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  streetAddress: z.string().max(255).optional(),
});
export type TaxAddress = z.infer<typeof TaxAddressSchema>;

/**
 * Line Item Input for Tax Calculation
 */
export const TaxLineItemInputSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1).optional(),
  categoryCode: z.string().min(1).default("standard"),
  quantity: z.number().int().positive().default(1),
  unitPrice: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Must be a valid decimal amount"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Must be a valid decimal amount"),
  discountAmount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional()
    .default("0.00"),
  isInclusive: z.boolean().optional().default(false),
});
export type TaxLineItemInput = z.infer<typeof TaxLineItemInputSchema>;

/**
 * Tax Quote Request (POST /api/v1/tax/quote)
 */
export const TaxQuoteRequestSchema = z.object({
  currency: z.string().length(3).toUpperCase().default("USD"),
  customerId: z.string().optional(),
  exemptionCertificate: z.string().optional(),
  destinationAddress: TaxAddressSchema,
  originAddress: TaxAddressSchema.optional(),
  lines: z
    .array(TaxLineItemInputSchema)
    .min(1, "At least one line item is required"),
  isInclusive: z.boolean().optional().default(false),
});
export type TaxQuoteRequest = z.infer<typeof TaxQuoteRequestSchema>;

/**
 * Tax Calculation Request (POST /api/v1/tax/calculate)
 * Persists an auditable snapshot for an order or authoritative transaction.
 */
export const TaxCalculateRequestSchema = TaxQuoteRequestSchema.extend({
  referenceId: z.string().min(1),
  referenceType: z.enum(["quote", "order", "invoice"]).default("order"),
});
export type TaxCalculateRequest = z.infer<typeof TaxCalculateRequestSchema>;

/**
 * Itemized Breakdown for Jurisdiction Level (State, County, City, etc.)
 */
export const TaxLineJurisdictionBreakdownSchema = z.object({
  jurisdictionCode: z.string(),
  jurisdictionName: z.string(),
  jurisdictionType: z
    .enum(["country", "region", "municipality", "special"])
    .default("region"),
  rate: z.string(),
  taxAmount: z.string(),
});
export type TaxLineJurisdictionBreakdown = z.infer<
  typeof TaxLineJurisdictionBreakdownSchema
>;

/**
 * Line Output in Tax Calculations
 */
export const TaxCalculationLineOutputSchema = z.object({
  lineId: z.string(),
  taxableAmount: z.string(),
  taxAmount: z.string(),
  rate: z.string(),
  jurisdictionCode: z.string(),
  isInclusive: z.boolean(),
  breakdown: z.array(TaxLineJurisdictionBreakdownSchema).optional().default([]),
});
export type TaxCalculationLineOutput = z.infer<
  typeof TaxCalculationLineOutputSchema
>;

/**
 * Structured Auditable Tax Quote / Calculation Response
 */
export const TaxCalculationResponseSchema = z.object({
  calculationId: z.string(),
  referenceId: z.string().optional(),
  referenceType: z
    .enum(["quote", "order", "invoice", "return"])
    .default("quote"),
  currency: z.string().length(3).toUpperCase(),
  subtotal: z.string(),
  taxTotal: z.string(),
  total: z.string(),
  lines: z.array(TaxCalculationLineOutputSchema),
  ruleVersion: z.string(),
  provider: z.string().default("standard"),
  isExempt: z.boolean().default(false),
  exemptionReason: z.string().optional(),
  calculatedAt: z.string(),
});
export type TaxCalculationResponse = z.infer<
  typeof TaxCalculationResponseSchema
>;

/**
 * Tax Return / Refund Line Input
 */
export const TaxReturnLineInputSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().int().positive(),
  returnAmount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Must be a valid decimal amount"),
  reason: z.string().max(255).optional(),
});
export type TaxReturnLineInput = z.infer<typeof TaxReturnLineInputSchema>;

/**
 * Tax Return Quote Request (POST /api/v1/tax/returns/quote)
 */
export const TaxReturnQuoteRequestSchema = z.object({
  originalCalculationId: z.string().min(1),
  returnReferenceId: z.string().optional(),
  returnedLines: z
    .array(TaxReturnLineInputSchema)
    .min(1, "At least one returned line required"),
});
export type TaxReturnQuoteRequest = z.infer<typeof TaxReturnQuoteRequestSchema>;

/**
 * Tax Return Quote Response
 */
export const TaxReturnQuoteResponseSchema = z.object({
  returnCalculationId: z.string(),
  originalCalculationId: z.string(),
  currency: z.string().length(3).toUpperCase(),
  subtotalRefund: z.string(),
  taxRefundTotal: z.string(),
  totalRefund: z.string(),
  lines: z.array(
    z.object({
      lineId: z.string(),
      returnedAmount: z.string(),
      taxRefundAmount: z.string(),
      adjustedRate: z.string(),
    }),
  ),
  ruleVersion: z.string(),
  adjustedAt: z.string(),
});
export type TaxReturnQuoteResponse = z.infer<
  typeof TaxReturnQuoteResponseSchema
>;

/**
 * Admin Tax Rule Management Schemas
 */
export const CreateTaxRuleSchema = z.object({
  jurisdictionId: z.string().min(1),
  categoryId: z.string().min(1),
  rate: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Rate must be a decimal string e.g. 0.0825"),
  isInclusive: z.boolean().default(false),
  priority: z.number().int().default(1),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  version: z.string().min(1).default("2026-10"),
  calculationMethod: z.enum(["percentage", "flat"]).default("percentage"),
  isActive: z.boolean().default(true),
});
export type CreateTaxRuleInput = z.infer<typeof CreateTaxRuleSchema>;

export const UpdateTaxRuleSchema = CreateTaxRuleSchema.partial();
export type UpdateTaxRuleInput = z.infer<typeof UpdateTaxRuleSchema>;

/**
 * Admin Jurisdiction & Category Schemas
 */
export const CreateTaxJurisdictionSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  regionCode: z.string().max(20).optional(),
  municipality: z.string().max(100).optional(),
  jurisdictionCode: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
});
export type CreateTaxJurisdictionInput = z.infer<
  typeof CreateTaxJurisdictionSchema
>;

export const CreateTaxCategorySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
});
export type CreateTaxCategoryInput = z.infer<typeof CreateTaxCategorySchema>;

export const CreateTaxExemptionSchema = z.object({
  customerId: z.string().min(1).optional(),
  exemptionCertificate: z.string().min(1).max(100),
  exemptionType: z.enum([
    "wholesale",
    "government",
    "diplomatic",
    "charity",
    "educational",
  ]),
  jurisdictionId: z.string().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateTaxExemptionInput = z.infer<typeof CreateTaxExemptionSchema>;

/**
 * Kafka Event Payloads
 */
export const TaxCalculationCompletedEventPayloadSchema = z.object({
  calculationId: z.string(),
  referenceId: z.string(),
  referenceType: z.string(),
  currency: z.string(),
  subtotal: z.string(),
  taxTotal: z.string(),
  total: z.string(),
  ruleVersion: z.string(),
  completedAt: z.string(),
});
export type TaxCalculationCompletedEventPayload = z.infer<
  typeof TaxCalculationCompletedEventPayloadSchema
>;

export const TaxCalculationFailedEventPayloadSchema = z.object({
  referenceId: z.string(),
  referenceType: z.string(),
  error: z.string(),
  failedAt: z.string(),
});
export type TaxCalculationFailedEventPayload = z.infer<
  typeof TaxCalculationFailedEventPayloadSchema
>;

export const TaxRulesUpdatedEventPayloadSchema = z.object({
  version: z.string(),
  updatedBy: z.string().optional(),
  ruleIds: z.array(z.string()),
  timestamp: z.string(),
});
export type TaxRulesUpdatedEventPayload = z.infer<
  typeof TaxRulesUpdatedEventPayloadSchema
>;

export const TaxCalculationAdjustedEventPayloadSchema = z.object({
  returnCalculationId: z.string(),
  originalCalculationId: z.string(),
  referenceId: z.string().optional(),
  taxRefundTotal: z.string(),
  adjustedAt: z.string(),
});
export type TaxCalculationAdjustedEventPayload = z.infer<
  typeof TaxCalculationAdjustedEventPayloadSchema
>;

/**
 * Domain Models for Admin Management & API Responses
 */
export interface TaxJurisdiction {
  id: string;
  countryCode: string;
  regionCode: string | null;
  municipality: string | null;
  jurisdictionCode: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxRule {
  id: string;
  jurisdictionId: string;
  categoryId: string;
  rate: string;
  isInclusive: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: string;
  calculationMethod: "percentage" | "flat";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  jurisdictionName?: string;
  categoryName?: string;
}

export interface TaxExemption {
  id: string;
  customerId: string | null;
  exemptionCertificate: string;
  exemptionType:
    | "wholesale"
    | "government"
    | "diplomatic"
    | "charity"
    | "educational";
  jurisdictionId: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxOverviewResponse {
  totalJurisdictions: number;
  activeRules: number;
  totalCategories: number;
  totalCalculations: number;
  provider: string;
}
