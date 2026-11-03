import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Commission Plans
// ==============================================================================
export const commissionPlans = pgTable(
  "commission_plans",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // ACTIVE, INACTIVE
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_plans_status_idx").on(table.status),
    index("commission_plans_is_default_idx").on(table.isDefault),
  ],
);

// ==============================================================================
// 2. Commission Rules
// ==============================================================================
export const commissionRules = pgTable(
  "commission_rules",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    planId: varchar("plan_id", { length: 64 })
      .notNull()
      .references(() => commissionPlans.id, { onDelete: "cascade" }),
    ruleType: varchar("rule_type", { length: 32 }).notNull().default("PERCENTAGE"), // PERCENTAGE, FIXED, TIERED, HYBRID
    scope: varchar("scope", { length: 32 }).notNull().default("GLOBAL"), // GLOBAL, SELLER, CATEGORY, PRODUCT
    scopeId: varchar("scope_id", { length: 128 }), // specific sellerId, categoryId, or productId
    percentageRate: numeric("percentage_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"), // e.g. 8.50%
    fixedAmount: numeric("fixed_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    minCommission: numeric("min_commission", { precision: 12, scale: 2 }),
    maxCommission: numeric("max_commission", { precision: 12, scale: 2 }),
    priority: integer("priority").notNull().default(0), // higher priority evaluated first
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // ACTIVE, INACTIVE
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_rules_plan_id_idx").on(table.planId),
    index("commission_rules_scope_idx").on(table.scope, table.scopeId),
    index("commission_rules_status_idx").on(table.status),
    index("commission_rules_priority_idx").on(table.priority),
  ],
);

// ==============================================================================
// 3. Commission Rule Versions (Audit & Historical Reproducibility)
// ==============================================================================
export const commissionRuleVersions = pgTable(
  "commission_rule_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ruleId: varchar("rule_id", { length: 64 })
      .notNull()
      .references(() => commissionRules.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    ruleSnapshot: jsonb("rule_snapshot").notNull(),
    changedBy: varchar("changed_by", { length: 128 }).notNull(),
    changeReason: text("change_reason").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_rule_versions_rule_id_idx").on(table.ruleId),
    index("commission_rule_versions_version_idx").on(table.version),
  ],
);

// ==============================================================================
// 4. Commission Calculations (Order-Level Calculations)
// ==============================================================================
export const commissionCalculations = pgTable(
  "commission_calculations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    orderId: varchar("order_id", { length: 128 }).notNull(),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    totalCommission: numeric("total_commission", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    netSellerPayout: numeric("net_seller_payout", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    currency: varchar("currency", { length: 8 }).notNull().default("PKR"),
    status: varchar("status", { length: 32 }).notNull().default("QUOTED"), // QUOTED, ACCRUED, ADJUSTED, REVERSED
    calculationSnapshot: jsonb("calculation_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_calculations_order_id_idx").on(table.orderId),
    index("commission_calculations_seller_id_idx").on(table.sellerId),
    index("commission_calculations_status_idx").on(table.status),
    index("commission_calculations_created_at_idx").on(table.createdAt),
  ],
);

// ==============================================================================
// 5. Commission Line Items (Granular Item-Level Calculations)
// ==============================================================================
export const commissionLineItems = pgTable(
  "commission_line_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    calculationId: varchar("calculation_id", { length: 64 })
      .notNull()
      .references(() => commissionCalculations.id, { onDelete: "cascade" }),
    orderId: varchar("order_id", { length: 128 }).notNull(),
    orderItemId: varchar("order_item_id", { length: 128 }).notNull(),
    productId: varchar("product_id", { length: 128 }).notNull(),
    categoryId: varchar("category_id", { length: 128 }).notNull(),
    sellerId: varchar("seller_id", { length: 64 }).notNull(),
    itemPrice: numeric("item_price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    commissionableAmount: numeric("commissionable_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    ruleId: varchar("rule_id", { length: 64 }).notNull(),
    ruleVersion: integer("rule_version").notNull().default(1),
    rateApplied: numeric("rate_applied", { precision: 5, scale: 2 }).notNull(),
    feeCalculated: numeric("fee_calculated", {
      precision: 12,
      scale: 2,
    }).notNull(),
    minMaxApplied: boolean("min_max_applied").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_line_items_calculation_id_idx").on(table.calculationId),
    index("commission_line_items_order_id_idx").on(table.orderId),
    index("commission_line_items_product_id_idx").on(table.productId),
    index("commission_line_items_seller_id_idx").on(table.sellerId),
  ],
);

// ==============================================================================
// 6. Commission Adjustments (Returns, Cancellations & Manual Adjustments)
// ==============================================================================
export const commissionAdjustments = pgTable(
  "commission_adjustments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    calculationId: varchar("calculation_id", { length: 64 })
      .notNull()
      .references(() => commissionCalculations.id, { onDelete: "cascade" }),
    orderId: varchar("order_id", { length: 128 }).notNull(),
    returnId: varchar("return_id", { length: 128 }),
    adjustmentType: varchar("adjustment_type", { length: 32 }).notNull(), // RETURN_REFUND, CANCELLATION, DISPUTE_REVERSAL, MANUAL_OVERRIDE
    amountAdjusted: numeric("amount_adjusted", {
      precision: 12,
      scale: 2,
    }).notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_adjustments_calculation_id_idx").on(table.calculationId),
    index("commission_adjustments_order_id_idx").on(table.orderId),
    index("commission_adjustments_return_id_idx").on(table.returnId),
  ],
);
