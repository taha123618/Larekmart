import {
  pgTable,
  varchar,
  numeric,
  boolean,
  integer,
  timestamp,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";

// ────────────────────────────────────────────────────────────
// 1. Payout Accounts (Seller Bank / Provider Routing Details)
// ────────────────────────────────────────────────────────────
export const payoutAccounts = pgTable(
  "payout_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    provider: varchar("provider", { length: 32 })
      .notNull()
      .default("MOCK_BANK"),
    accountHolderName: varchar("account_holder_name", {
      length: 255,
    }).notNull(),
    accountNumberMasked: varchar("account_number_masked", {
      length: 64,
    }).notNull(),
    routingOrIban: varchar("routing_or_iban", { length: 64 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    schedule: varchar("schedule", { length: 32 }).notNull().default("WEEKLY"),
    isVerified: boolean("is_verified").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(true),
    holdPayouts: boolean("hold_payouts").notNull().default(false),
    holdReason: text("hold_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payout_accounts_seller").on(table.sellerId),
    index("idx_payout_accounts_currency").on(table.currency),
  ],
);

// ────────────────────────────────────────────────────────────
// 2. Ledger Accounts (Double-Entry Chart of Accounts)
// ────────────────────────────────────────────────────────────
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 }),
    accountType: varchar("account_type", { length: 64 }).notNull(), // SELLER_ESCROW, PLATFORM_COMMISSION, PAYOUT_CLEARING, DISPUTE_RESERVE, TAX_WITHHOLDING
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_ledger_accounts_seller").on(table.sellerId),
    index("idx_ledger_accounts_type").on(table.accountType),
  ],
);

// ────────────────────────────────────────────────────────────
// 3. Ledger Entries (Balanced Double-Entry Append-Only Journal)
// ────────────────────────────────────────────────────────────
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    transactionId: varchar("transaction_id", { length: 64 }).notNull(),
    accountId: varchar("account_id", { length: 64 })
      .notNull()
      .references(() => ledgerAccounts.id),
    entryType: varchar("entry_type", { length: 16 }).notNull(), // CREDIT, DEBIT
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    referenceType: varchar("reference_type", { length: 64 }).notNull(), // ORDER_PAYMENT, COMMISSION_ACCRUAL, RETURN_ADJUSTMENT, DISPUTE_LOCK, PAYOUT_DISBURSEMENT
    referenceId: varchar("reference_id", { length: 64 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 18, scale: 4 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_ledger_entries_txn").on(table.transactionId),
    index("idx_ledger_entries_account").on(table.accountId),
    index("idx_ledger_entries_ref").on(table.referenceType, table.referenceId),
    index("idx_ledger_entries_created").on(table.createdAt),
  ],
);

// ────────────────────────────────────────────────────────────
// 4. Payout Batches (Settlement Run Aggregation)
// ────────────────────────────────────────────────────────────
export const payoutBatches = pgTable(
  "payout_batches",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    batchNumber: varchar("batch_number", { length: 64 }).notNull().unique(),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    totalPayouts: integer("total_payouts").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("OPEN"), // OPEN, PROCESSING, RECONCILED, CLOSED
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payout_batches_status").on(table.status),
    index("idx_payout_batches_scheduled").on(table.scheduledFor),
  ],
);

// ────────────────────────────────────────────────────────────
// 5. Payouts (Individual Payout Disbursements)
// ────────────────────────────────────────────────────────────
export const payouts = pgTable(
  "payouts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    payoutNumber: varchar("payout_number", { length: 64 }).notNull().unique(),
    batchId: varchar("batch_id", { length: 64 }).references(
      () => payoutBatches.id,
    ),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    payoutAccountId: varchar("payout_account_id", { length: 64 })
      .notNull()
      .references(() => payoutAccounts.id),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    status: varchar("status", { length: 32 }).notNull().default("SCHEDULED"), // SCHEDULED, PROCESSING, COMPLETED, FAILED, CANCELLED, ON_HOLD
    idempotencyKey: varchar("idempotency_key", { length: 128 })
      .notNull()
      .unique(),
    providerReference: varchar("provider_reference", { length: 128 }),
    failureReason: text("failure_reason"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payouts_seller").on(table.sellerId),
    index("idx_payouts_batch").on(table.batchId),
    index("idx_payouts_status").on(table.status),
    index("idx_payouts_idempotency").on(table.idempotencyKey),
  ],
);

// ────────────────────────────────────────────────────────────
// 6. Settlements (Settlement Periods & Reconciled Statements)
// ────────────────────────────────────────────────────────────
export const settlements = pgTable(
  "settlements",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    settlementNumber: varchar("settlement_number", { length: 64 })
      .notNull()
      .unique(),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    grossSales: numeric("gross_sales", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    totalCommission: numeric("total_commission", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    totalRefunds: numeric("total_refunds", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    reserveWithheld: numeric("reserve_withheld", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    reserveReleased: numeric("reserve_released", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    netSettlement: numeric("net_settlement", { precision: 18, scale: 2 })
      .notNull()
      .default("0.00"),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    payoutId: varchar("payout_id", { length: 64 }).references(() => payouts.id),
    status: varchar("status", { length: 32 }).notNull().default("CLOSED"),
    statementSnapshot: jsonb("statement_snapshot")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_settlements_seller").on(table.sellerId),
    index("idx_settlements_period").on(table.periodStart, table.periodEnd),
  ],
);

// ────────────────────────────────────────────────────────────
// 7. Payout Adjustments (Manual adjustments, chargeback holds)
// ────────────────────────────────────────────────────────────
export const payoutAdjustments = pgTable(
  "payout_adjustments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    payoutId: varchar("payout_id", { length: 64 }).references(() => payouts.id),
    adjustmentType: varchar("adjustment_type", { length: 64 }).notNull(), // COMMISSION_REBATE, RETURN_DEDUCTION, DISPUTE_HOLD, DISPUTE_RELEASE, MANUAL_FEE, MANUAL_CREDIT
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
    reason: text("reason").notNull(),
    referenceId: varchar("reference_id", { length: 64 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payout_adjustments_seller").on(table.sellerId),
    index("idx_payout_adjustments_type").on(table.adjustmentType),
  ],
);

// ────────────────────────────────────────────────────────────
// 8. Payout Provider Events (Idempotent Webhook/Callback Logs)
// ────────────────────────────────────────────────────────────
export const payoutProviderEvents = pgTable(
  "payout_provider_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventId: varchar("event_id", { length: 128 }).notNull().unique(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payoutId: varchar("payout_id", { length: 64 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PROCESSED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payout_provider_events_payout").on(table.payoutId),
    index("idx_payout_provider_events_event").on(table.eventId),
  ],
);
