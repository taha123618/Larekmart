import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Promotions Table
// ==============================================================================
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull(), // 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
    maxDiscountAmount: numeric("max_discount_amount", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 50 }).default("DRAFT").notNull(), // 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DEACTIVATED'
    priority: integer("priority").default(0).notNull(),
    isStackable: boolean("is_stackable").default(false).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotions_status_idx").on(table.status),
    index("promotions_dates_idx").on(table.startDate, table.endDate),
    index("promotions_type_idx").on(table.type),
    index("promotions_priority_idx").on(table.priority),
  ],
);

// ==============================================================================
// 2. Promotion Rules Table
// ==============================================================================
export const promotionRules = pgTable(
  "promotion_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    customerSegment: varchar("customer_segment", { length: 50 }).default("ALL").notNull(), // 'ALL' | 'FIRST_TIME' | 'VIP'
    maxPerCustomer: integer("max_per_customer").default(1).notNull(),
    globalLimit: integer("global_limit"),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotion_rules_promo_idx").on(table.promotionId),
  ],
);

// ==============================================================================
// 3. Promotion Targets Table
// ==============================================================================
export const promotionTargets = pgTable(
  "promotion_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'PRODUCT' | 'CATEGORY' | 'SELLER' | 'ORDER'
    targetId: varchar("target_id", { length: 255 }),
    ruleType: varchar("rule_type", { length: 50 }).default("INCLUDE").notNull(), // 'INCLUDE' | 'EXCLUDE'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotion_targets_promo_idx").on(table.promotionId),
    index("promotion_targets_lookup_idx").on(table.targetType, table.targetId),
  ],
);

// ==============================================================================
// 4. Coupon Codes Table
// ==============================================================================
export const couponCodes = pgTable(
  "coupon_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    maxRedemptions: integer("max_redemptions"),
    redemptionsCount: integer("redemptions_count").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("coupon_codes_code_unique").on(table.code),
    index("coupon_codes_promo_idx").on(table.promotionId),
    index("coupon_codes_active_idx").on(table.isActive),
  ],
);

// ==============================================================================
// 5. Promotion Reservations Table
// ==============================================================================
export const promotionReservations = pgTable(
  "promotion_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    couponId: uuid("coupon_id").references(() => couponCodes.id, { onDelete: "set null" }),
    userId: varchar("user_id", { length: 255 }),
    guestId: varchar("guest_id", { length: 255 }),
    orderId: varchar("order_id", { length: 255 }),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("RESERVED").notNull(), // 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED'
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotion_reservations_promo_idx").on(table.promotionId),
    index("promotion_reservations_status_idx").on(table.status),
    index("promotion_reservations_expires_idx").on(table.expiresAt),
    index("promotion_reservations_user_idx").on(table.userId),
    index("promotion_reservations_guest_idx").on(table.guestId),
  ],
);

// ==============================================================================
// 6. Promotion Redemptions Table
// ==============================================================================
export const promotionRedemptions = pgTable(
  "promotion_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    couponId: uuid("coupon_id").references(() => couponCodes.id, { onDelete: "set null" }),
    reservationId: uuid("reservation_id").references(() => promotionReservations.id, { onDelete: "set null" }),
    userId: varchar("user_id", { length: 255 }),
    orderId: varchar("order_id", { length: 255 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotion_redemptions_order_idx").on(table.orderId),
    index("promotion_redemptions_promo_idx").on(table.promotionId),
    index("promotion_redemptions_user_idx").on(table.userId),
    index("promotion_redemptions_redeemed_idx").on(table.redeemedAt),
  ],
);

// ==============================================================================
// 7. Promotion Budgets Table
// ==============================================================================
export const promotionBudgets = pgTable(
  "promotion_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promotionId: uuid("promotion_id")
      .references(() => promotions.id, { onDelete: "cascade" })
      .notNull(),
    totalBudget: numeric("total_budget", { precision: 14, scale: 2 }).notNull(),
    reservedAmount: numeric("reserved_amount", { precision: 14, scale: 2 }).default("0.00").notNull(),
    spentAmount: numeric("spent_amount", { precision: 14, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 10 }).default("USD").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("promotion_budgets_promo_unique").on(table.promotionId),
  ],
);

// ==============================================================================
// 8. Promotion Audit Logs Table
// ==============================================================================
export const promotionAuditLogs = pgTable(
  "promotion_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 50 }).default("PROMOTION").notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    performedBy: varchar("performed_by", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("promotion_audit_entity_idx").on(table.entityType, table.entityId),
    index("promotion_audit_created_idx").on(table.createdAt),
  ],
);
