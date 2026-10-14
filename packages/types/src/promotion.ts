import { z } from "zod";

// ============================================================================
// Enums & Literals
// ============================================================================

export const PromotionStatusEnum = z.enum([
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "DEACTIVATED",
]);
export type PromotionStatus = z.infer<typeof PromotionStatusEnum>;

export const PromotionTypeEnum = z.enum([
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_SHIPPING",
]);
export type PromotionType = z.infer<typeof PromotionTypeEnum>;

export const CustomerSegmentEnum = z.enum(["ALL", "FIRST_TIME", "VIP"]);
export type CustomerSegment = z.infer<typeof CustomerSegmentEnum>;

export const TargetTypeEnum = z.enum(["PRODUCT", "CATEGORY", "SELLER", "ORDER"]);
export type TargetType = z.infer<typeof TargetTypeEnum>;

export const TargetRuleTypeEnum = z.enum(["INCLUDE", "EXCLUDE"]);
export type TargetRuleType = z.infer<typeof TargetRuleTypeEnum>;

export const ReservationStatusEnum = z.enum([
  "RESERVED",
  "COMMITTED",
  "RELEASED",
  "EXPIRED",
]);
export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;

// ============================================================================
// Core Domain Entities
// ============================================================================

export interface Promotion {
  id: string;
  name: string;
  description?: string | null;
  status: PromotionStatus;
  type: PromotionType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  startDate: string;
  endDate: string;
  priority: number;
  isStackable: boolean;
  createdAt: string;
  updatedAt: string;
  rules?: PromotionRule;
  targets?: PromotionTarget[];
  budget?: PromotionBudget | null;
  coupons?: CouponCode[];
}

export interface PromotionRule {
  id: string;
  promotionId: string;
  minOrderAmount: number;
  customerSegment: CustomerSegment;
  maxPerCustomer: number;
  globalLimit?: number | null;
  usageCount: number;
}

export interface PromotionTarget {
  id: string;
  promotionId: string;
  targetType: TargetType;
  targetId?: string | null;
  ruleType: TargetRuleType;
}

export interface CouponCode {
  id: string;
  code: string;
  promotionId: string;
  maxRedemptions?: number | null;
  redemptionsCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface PromotionReservation {
  id: string;
  promotionId: string;
  couponId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  orderId?: string | null;
  discountAmount: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface PromotionRedemption {
  id: string;
  promotionId: string;
  couponId?: string | null;
  reservationId?: string | null;
  userId?: string | null;
  orderId: string;
  discountAmount: number;
  redeemedAt: string;
}

export interface PromotionBudget {
  id: string;
  promotionId: string;
  totalBudget: number;
  reservedAmount: number;
  spentAmount: number;
  currency: string;
}

export interface PromotionAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================================================
// Request & Response Schemas
// ============================================================================

export const TargetInputSchema = z.object({
  targetType: TargetTypeEnum,
  targetId: z.string().optional(),
  ruleType: TargetRuleTypeEnum.default("INCLUDE"),
});
export type TargetInput = z.infer<typeof TargetInputSchema>;

export const RuleInputSchema = z.object({
  minOrderAmount: z.number().nonnegative().default(0),
  customerSegment: CustomerSegmentEnum.default("ALL"),
  maxPerCustomer: z.number().int().positive().default(1),
  globalLimit: z.number().int().positive().optional(),
});
export type RuleInput = z.infer<typeof RuleInputSchema>;

export const BudgetInputSchema = z.object({
  totalBudget: z.number().positive(),
  currency: z.string().default("USD"),
});
export type BudgetInput = z.infer<typeof BudgetInputSchema>;

export const CreatePromotionSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  type: PromotionTypeEnum,
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  priority: z.number().int().default(0),
  isStackable: z.boolean().default(false),
  rules: RuleInputSchema.optional(),
  targets: z.array(TargetInputSchema).optional(),
  budget: BudgetInputSchema.optional(),
});
export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;

export const UpdatePromotionSchema = CreatePromotionSchema.partial();
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;

export const CreateCouponSchema = z.object({
  promotionId: z.string().uuid(),
  code: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Code must contain uppercase letters, numbers, hyphens or underscores"),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;

export const CartItemContextSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().optional(),
  categoryId: z.string().optional(),
  sellerId: z.string().optional(),
  price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
});
export type CartItemContext = z.infer<typeof CartItemContextSchema>;

export const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  userId: z.string().optional(),
  guestId: z.string().optional(),
  items: z.array(CartItemContextSchema),
});
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;

export interface ValidateCouponResponse {
  valid: boolean;
  code: string;
  promotionId?: string;
  promotionName?: string;
  discountType?: PromotionType;
  discountValue?: number;
  estimatedDiscount?: number;
  reason?: string;
}

export const PromotionQuoteSchema = z.object({
  userId: z.string().optional(),
  guestId: z.string().optional(),
  items: z.array(CartItemContextSchema),
  couponCodes: z.array(z.string()).default([]),
});
export type PromotionQuoteInput = z.infer<typeof PromotionQuoteSchema>;

export interface DiscountBreakdown {
  promotionId: string;
  promotionName: string;
  code?: string;
  type: PromotionType;
  discountAmount: number;
  appliedToItemIds?: number[];
}

export interface PromotionQuoteResponse {
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  freeShipping: boolean;
  appliedDiscounts: DiscountBreakdown[];
  invalidCoupons: Array<{ code: string; reason: string }>;
}

export const CreateReservationSchema = z.object({
  promotionId: z.string().uuid(),
  couponCode: z.string().optional(),
  userId: z.string().optional(),
  guestId: z.string().optional(),
  orderId: z.string().optional(),
  discountAmount: z.number().positive(),
  ttlSeconds: z.number().int().positive().default(900), // 15 mins default
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const CommitReservationSchema = z.object({
  orderId: z.string().min(1),
});
export type CommitReservationInput = z.infer<typeof CommitReservationSchema>;

export const ReleaseReservationSchema = z.object({
  reason: z.string().optional(),
});
export type ReleaseReservationInput = z.infer<typeof ReleaseReservationSchema>;

export interface PromotionOverviewResponse {
  totalPromotions: number;
  activePromotions: number;
  totalCoupons: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  activeReservationsCount: number;
  topPromotions: Array<{
    promotionId: string;
    name: string;
    redemptionsCount: number;
    discountGiven: number;
  }>;
}

// ============================================================================
// Kafka Event Contracts
// ============================================================================

export interface PromotionCreatedEvent {
  promotionId: string;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface PromotionActivatedEvent {
  promotionId: string;
  name: string;
  activatedAt: string;
}

export interface PromotionDeactivatedEvent {
  promotionId: string;
  name: string;
  deactivatedAt: string;
}

export interface PromotionReservedEvent {
  reservationId: string;
  promotionId: string;
  couponCode?: string | null;
  userId?: string | null;
  orderId?: string | null;
  discountAmount: number;
  expiresAt: string;
}

export interface PromotionRedeemedEvent {
  redemptionId: string;
  promotionId: string;
  couponCode?: string | null;
  userId?: string | null;
  orderId: string;
  discountAmount: number;
  redeemedAt: string;
}

export interface PromotionReservationReleasedEvent {
  reservationId: string;
  promotionId: string;
  discountAmount?: number;
  releasedAt: string;
  reason?: string | null;
}

export interface PromotionBudgetExhaustedEvent {
  promotionId: string;
  totalBudget?: number;
  spentAmount?: number;
  exhaustedAt: string;
}

