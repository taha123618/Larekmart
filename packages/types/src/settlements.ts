import { z } from "zod";

// ==============================================================================
// 1. Settlement & Escrow Enums
// ==============================================================================

export const EscrowStatusEnum = {
  HELD_IN_ESCROW: "HELD_IN_ESCROW",
  RELEASED: "RELEASED",
  REFUNDED_RETURN: "REFUNDED_RETURN",
  DISPUTE_FROZEN: "DISPUTE_FROZEN",
} as const;

export type EscrowStatus =
  (typeof EscrowStatusEnum)[keyof typeof EscrowStatusEnum];

export const EscrowStatusSchema = z.enum([
  EscrowStatusEnum.HELD_IN_ESCROW,
  EscrowStatusEnum.RELEASED,
  EscrowStatusEnum.REFUNDED_RETURN,
  EscrowStatusEnum.DISPUTE_FROZEN,
]);

export const PayoutStatusEnum = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
} as const;

export type PayoutStatus =
  (typeof PayoutStatusEnum)[keyof typeof PayoutStatusEnum];

export const PayoutStatusSchema = z.enum([
  PayoutStatusEnum.PENDING_APPROVAL,
  PayoutStatusEnum.PROCESSING,
  PayoutStatusEnum.PAID,
  PayoutStatusEnum.REJECTED,
  PayoutStatusEnum.FAILED,
]);

export const PayoutMethodEnum = {
  BANK_TRANSFER: "BANK_TRANSFER",
  STRIPE_CONNECT: "STRIPE_CONNECT",
  RAAST_INSTANT: "RAAST_INSTANT",
} as const;

export type PayoutMethod =
  (typeof PayoutMethodEnum)[keyof typeof PayoutMethodEnum];

export const PayoutMethodSchema = z.enum([
  PayoutMethodEnum.BANK_TRANSFER,
  PayoutMethodEnum.STRIPE_CONNECT,
  PayoutMethodEnum.RAAST_INSTANT,
]);

export const LedgerEntryTypeEnum = {
  ORDER_ESCROW_CREDIT: "ORDER_ESCROW_CREDIT",
  PLATFORM_COMMISSION_DEBIT: "PLATFORM_COMMISSION_DEBIT",
  ESCROW_RELEASE_TO_AVAILABLE: "ESCROW_RELEASE_TO_AVAILABLE",
  PAYOUT_RESERVATION_DEBIT: "PAYOUT_RESERVATION_DEBIT",
  PAYOUT_SETTLED: "PAYOUT_SETTLED",
  RETURN_ESCROW_REVERSAL: "RETURN_ESCROW_REVERSAL",
  DISPUTE_HOLD: "DISPUTE_HOLD",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
} as const;

export type LedgerEntryType =
  (typeof LedgerEntryTypeEnum)[keyof typeof LedgerEntryTypeEnum];

export const LedgerEntryTypeSchema = z.enum([
  LedgerEntryTypeEnum.ORDER_ESCROW_CREDIT,
  LedgerEntryTypeEnum.PLATFORM_COMMISSION_DEBIT,
  LedgerEntryTypeEnum.ESCROW_RELEASE_TO_AVAILABLE,
  LedgerEntryTypeEnum.PAYOUT_RESERVATION_DEBIT,
  LedgerEntryTypeEnum.PAYOUT_SETTLED,
  LedgerEntryTypeEnum.RETURN_ESCROW_REVERSAL,
  LedgerEntryTypeEnum.DISPUTE_HOLD,
  LedgerEntryTypeEnum.MANUAL_ADJUSTMENT,
]);

// ==============================================================================
// 2. Core Settlement Domain Schemas
// ==============================================================================

export const VendorCommissionRateSchema = z.object({
  id: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional().nullable(),
  categoryId: z.string().min(1),
  categoryName: z.string().optional(),
  ratePercentage: z
    .number()
    .min(0, "Commission cannot be negative")
    .max(100, "Commission cannot exceed 100%"),
  effectiveFrom: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type VendorCommissionRate = z.infer<typeof VendorCommissionRateSchema>;

export const VendorEscrowTransactionSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  orderId: z.string().min(1),
  orderItemId: z.string().optional().nullable(),
  grossAmount: z.number().nonnegative(),
  commissionRate: z.number().min(0).max(100),
  commissionAmount: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  currency: z.string().default("PKR"),
  status: EscrowStatusSchema,
  deliveredAt: z.string().datetime().optional().nullable(),
  releaseDueAt: z.string().datetime().optional().nullable(),
  releasedAt: z.string().datetime().optional().nullable(),
  disputeReason: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VendorEscrowTransaction = z.infer<
  typeof VendorEscrowTransactionSchema
>;

export const VendorBalanceSchema = z.object({
  vendorId: z.string().uuid(),
  currency: z.string().default("PKR"),
  availableBalance: z.number().nonnegative(),
  escrowBalance: z.number().nonnegative(),
  disputeFrozenBalance: z.number().nonnegative().default(0),
  lifetimeEarnings: z.number().nonnegative(),
  lifetimePaid: z.number().nonnegative(),
  lastPayoutAt: z.string().datetime().optional().nullable(),
  updatedAt: z.string().datetime(),
});

export type VendorBalance = z.infer<typeof VendorBalanceSchema>;

export const RequestPayoutSchema = z.object({
  amount: z
    .number()
    .positive("Payout amount must be positive")
    .min(5000, "Minimum payout request threshold is 5,000 PKR (or equivalent)"),
  currency: z.string().default("PKR"),
  paymentMethod: PayoutMethodSchema.default(PayoutMethodEnum.BANK_TRANSFER),
  notes: z.string().max(500).optional(),
});

export type RequestPayoutInput = z.infer<typeof RequestPayoutSchema>;

export const VendorPayoutRequestSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("PKR"),
  paymentMethod: PayoutMethodSchema,
  status: PayoutStatusSchema,
  bankName: z.string().optional().nullable(),
  accountTitle: z.string().optional().nullable(),
  accountNumberOrIban: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  transactionReference: z.string().optional().nullable(),
  requestedAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
});

export type VendorPayoutRequest = z.infer<typeof VendorPayoutRequestSchema>;

export const PayoutBatchSchema = z.object({
  id: z.string().uuid(),
  batchNumber: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalGrossAmount: z.number().nonnegative(),
  totalCommissionDeducted: z.number().nonnegative(),
  totalNetAmount: z.number().nonnegative(),
  vendorCount: z.number().int().nonnegative(),
  status: PayoutStatusSchema,
  approvedByAdminId: z.string().optional().nullable(),
  executedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
});

export type PayoutBatch = z.infer<typeof PayoutBatchSchema>;

export const VendorSettlementOverviewSchema = z.object({
  totalPlatformEscrow: z.number().nonnegative(),
  totalAvailablePayoutLiabilities: z.number().nonnegative(),
  totalDisbursedLifetime: z.number().nonnegative(),
  totalCommissionCollectedLifetime: z.number().nonnegative(),
  pendingPayoutRequestsCount: z.number().int().nonnegative(),
  pendingPayoutRequestsAmount: z.number().nonnegative(),
  activeDisputedEscrowCount: z.number().int().nonnegative(),
  activeDisputedEscrowAmount: z.number().nonnegative(),
});

export type VendorSettlementOverview = z.infer<
  typeof VendorSettlementOverviewSchema
>;

// ==============================================================================
// 3. Kafka Event Contracts for Escrow & Settlements
// ==============================================================================

export const VendorEscrowCreditedPayloadSchema = z.object({
  eventId: z.string(),
  eventType: z.literal("vendor.escrow.credited"),
  vendorId: z.string().uuid(),
  orderId: z.string().min(1),
  grossAmount: z.number().nonnegative(),
  commissionRate: z.number().min(0).max(100),
  commissionAmount: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  currency: z.string(),
  timestamp: z.string().datetime(),
});

export type VendorEscrowCreditedPayload = z.infer<
  typeof VendorEscrowCreditedPayloadSchema
>;

export const VendorEscrowReleasedPayloadSchema = z.object({
  eventId: z.string(),
  eventType: z.literal("vendor.escrow.released"),
  vendorId: z.string().uuid(),
  orderId: z.string().min(1),
  releasedAmount: z.number().nonnegative(),
  currency: z.string(),
  releasedAt: z.string().datetime(),
});

export type VendorEscrowReleasedPayload = z.infer<
  typeof VendorEscrowReleasedPayloadSchema
>;

export const VendorPayoutRequestedPayloadSchema = z.object({
  eventId: z.string(),
  eventType: z.literal("vendor.payout.requested"),
  payoutRequestId: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string(),
  requestedAt: z.string().datetime(),
});

export type VendorPayoutRequestedPayload = z.infer<
  typeof VendorPayoutRequestedPayloadSchema
>;

export const VendorPayoutCompletedPayloadSchema = z.object({
  eventId: z.string(),
  eventType: z.literal("vendor.payout.completed"),
  payoutRequestId: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string(),
  transactionReference: z.string(),
  completedAt: z.string().datetime(),
});

export type VendorPayoutCompletedPayload = z.infer<
  typeof VendorPayoutCompletedPayloadSchema
>;
