import { z } from "zod";

// ============================================================================
// Payout & Ledger Enums
// ============================================================================

export const PayoutExecutionStatusEnum = z.enum([
  "SCHEDULED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ON_HOLD",
]);
export type PayoutExecutionStatus = z.infer<typeof PayoutExecutionStatusEnum>;

export const PayoutBatchRunStatusEnum = z.enum([
  "OPEN",
  "PROCESSING",
  "RECONCILED",
  "CLOSED",
]);
export type PayoutBatchRunStatus = z.infer<typeof PayoutBatchRunStatusEnum>;

export const LedgerAccountTypeEnum = z.enum([
  "SELLER_ESCROW",
  "PLATFORM_COMMISSION",
  "PAYOUT_CLEARING",
  "DISPUTE_RESERVE",
  "TAX_WITHHOLDING",
]);
export type LedgerAccountType = z.infer<typeof LedgerAccountTypeEnum>;

export const LedgerDirectionEnum = z.enum(["CREDIT", "DEBIT"]);
export type LedgerDirection = z.infer<typeof LedgerDirectionEnum>;

export const PayoutScheduleFrequencyEnum = z.enum([
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "MANUAL",
]);
export type PayoutScheduleFrequency = z.infer<
  typeof PayoutScheduleFrequencyEnum
>;

export const PayoutAdjustmentActionEnum = z.enum([
  "COMMISSION_REBATE",
  "RETURN_DEDUCTION",
  "DISPUTE_HOLD",
  "DISPUTE_RELEASE",
  "MANUAL_FEE",
  "MANUAL_CREDIT",
]);
export type PayoutAdjustmentAction = z.infer<typeof PayoutAdjustmentActionEnum>;

// ============================================================================
// Payout Account Schemas
// ============================================================================

export const PayoutAccountSchema = z.object({
  id: z.string(),
  sellerId: z.string(),
  provider: z.string().default("MOCK_BANK"),
  accountHolderName: z.string().min(1),
  accountNumberMasked: z.string().min(4),
  routingOrIban: z.string().min(1),
  currency: z.string().length(3).default("PKR"),
  schedule: PayoutScheduleFrequencyEnum.default("WEEKLY"),
  isVerified: z.boolean().default(false),
  isDefault: z.boolean().default(true),
  holdPayouts: z.boolean().default(false),
  holdReason: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});
export type PayoutAccount = z.infer<typeof PayoutAccountSchema>;

// ============================================================================
// Ledger Schemas (Balanced Append-Only)
// ============================================================================

export const LedgerAccountSchema = z.object({
  id: z.string(),
  sellerId: z.string().nullable().optional(),
  accountType: LedgerAccountTypeEnum,
  currency: z.string().length(3),
  description: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type LedgerAccount = z.infer<typeof LedgerAccountSchema>;

export const DoubleEntryLedgerRecordSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  accountId: z.string(),
  entryType: LedgerDirectionEnum,
  amount: z.union([z.string(), z.number()]),
  currency: z.string().length(3),
  referenceType: z.string(),
  referenceId: z.string(),
  balanceAfter: z.union([z.string(), z.number()]).nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type DoubleEntryLedgerRecord = z.infer<
  typeof DoubleEntryLedgerRecordSchema
>;

// ============================================================================
// Payout & Batch Schemas
// ============================================================================

export const SellerPayoutBatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  currency: z.string().length(3),
  totalAmount: z.union([z.string(), z.number()]),
  totalPayouts: z.number().int().nonnegative(),
  status: PayoutBatchRunStatusEnum,
  scheduledFor: z.date().or(z.string()),
  reconciledAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});
export type SellerPayoutBatch = z.infer<typeof SellerPayoutBatchSchema>;

export const PayoutRecordSchema = z.object({
  id: z.string(),
  payoutNumber: z.string(),
  batchId: z.string().nullable().optional(),
  sellerId: z.string(),
  payoutAccountId: z.string(),
  amount: z.union([z.string(), z.number()]),
  feeAmount: z.union([z.string(), z.number()]).default("0.00"),
  netAmount: z.union([z.string(), z.number()]),
  currency: z.string().length(3),
  status: PayoutExecutionStatusEnum,
  idempotencyKey: z.string(),
  providerReference: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  processedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});
export type PayoutRecord = z.infer<typeof PayoutRecordSchema>;

export const PayoutAdjustmentRecordSchema = z.object({
  id: z.string(),
  sellerId: z.string(),
  payoutId: z.string().nullable().optional(),
  adjustmentType: PayoutAdjustmentActionEnum,
  amount: z.union([z.string(), z.number()]),
  currency: z.string().length(3),
  reason: z.string(),
  referenceId: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type PayoutAdjustmentRecord = z.infer<
  typeof PayoutAdjustmentRecordSchema
>;

// ============================================================================
// API Request & Response Contracts
// ============================================================================

export const SellerBalanceResponseSchema = z.object({
  sellerId: z.string(),
  currency: z.string().length(3),
  availableBalance: z.number(),
  pendingSettlement: z.number(),
  reserveHold: z.number(),
  lifetimePayouts: z.number(),
  lastPayoutAt: z.string().nullable().optional(),
  holdPayouts: z.boolean(),
  holdReason: z.string().nullable().optional(),
});
export type SellerBalanceResponse = z.infer<typeof SellerBalanceResponseSchema>;

export const PayoutScheduleRequestSchema = z.object({
  sellerIds: z.array(z.string()).optional(),
  currency: z.string().length(3).default("PKR"),
  minimumThreshold: z.number().positive().default(500),
  idempotencyKey: z.string().min(8),
});
export type PayoutScheduleRequest = z.infer<typeof PayoutScheduleRequestSchema>;

export const PayoutReconcileRequestSchema = z.object({
  batchId: z.string(),
  providerEvents: z.array(
    z.object({
      payoutId: z.string(),
      providerRef: z.string(),
      status: z.enum(["SUCCESS", "FAILED"]),
      failureCode: z.string().optional(),
      failureMessage: z.string().optional(),
      settledAt: z.string().optional(),
    }),
  ),
});
export type PayoutReconcileRequest = z.infer<
  typeof PayoutReconcileRequestSchema
>;

// ============================================================================
// Kafka Topics & Event Payloads
// ============================================================================

export const PAYOUT_TOPICS = {
  SCHEDULED: "payout.scheduled",
  PROCESSING: "payout.processing",
  COMPLETED: "payout.completed",
  FAILED: "payout.failed",
  RECONCILED: "payout.reconciled",
} as const;

export interface PayoutScheduledEventPayload {
  payoutId: string;
  payoutNumber: string;
  sellerId: string;
  batchId?: string | null;
  amount: number;
  netAmount: number;
  currency: string;
  idempotencyKey: string;
  timestamp: string;
}

export interface PayoutProcessingEventPayload {
  payoutId: string;
  payoutNumber: string;
  sellerId: string;
  provider: string;
  providerReference?: string | null;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface PayoutCompletedEventPayload {
  payoutId: string;
  payoutNumber: string;
  sellerId: string;
  providerReference: string;
  amount: number;
  currency: string;
  settledAt: string;
  timestamp: string;
}

export interface PayoutFailedEventPayload {
  payoutId: string;
  payoutNumber: string;
  sellerId: string;
  failureReason: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface PayoutReconciledEventPayload {
  batchId: string;
  totalPayouts: number;
  totalSettledAmount: number;
  currency: string;
  reconciledCount: number;
  failedCount: number;
  timestamp: string;
}
