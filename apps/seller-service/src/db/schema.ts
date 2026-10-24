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
// 1. Sellers (Seller Accounts tied to a legal Vendor)
// ==============================================================================
export const sellers = pgTable(
  "sellers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    vendorId: varchar("vendor_id", { length: 64 }).notNull(),
    primaryUserId: varchar("primary_user_id", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("ONBOARDING"), // ONBOARDING, ACTIVE, SUSPENDED, INACTIVE
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sellers_vendor_id_idx").on(table.vendorId),
    index("sellers_primary_user_id_idx").on(table.primaryUserId),
    index("sellers_status_idx").on(table.status),
  ],
);

// ==============================================================================
// 2. Seller Stores (Public Storefront Configuration)
// ==============================================================================
export const sellerStores = pgTable(
  "seller_stores",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    headline: varchar("headline", { length: 256 }),
    description: text("description"),
    logoMediaId: varchar("logo_media_id", { length: 128 }),
    bannerMediaId: varchar("banner_media_id", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // ACTIVE, VACATION, MAINTENANCE, CLOSED
    vacationMode: boolean("vacation_mode").notNull().default(false),
    vacationMessage: text("vacation_message"),
    vacationEndDate: timestamp("vacation_end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("seller_stores_seller_id_idx").on(table.sellerId),
    index("seller_stores_slug_idx").on(table.slug),
    index("seller_stores_status_idx").on(table.status),
  ],
);

// ==============================================================================
// 3. Seller Staff (Store Staff Members & Permissions)
// ==============================================================================
export const sellerStaff = pgTable(
  "seller_staff",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("MANAGER"), // OWNER, MANAGER, CATALOG_SPECIALIST, FULFILLMENT_OPERATOR, CUSTOMER_SUPPORT
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // INVITED, ACTIVE, SUSPENDED, REVOKED
    permissions: jsonb("permissions").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("seller_staff_seller_id_idx").on(table.sellerId),
    index("seller_staff_user_id_idx").on(table.userId),
  ],
);

// ==============================================================================
// 4. Seller Settings (Operational Settings)
// ==============================================================================
export const sellerSettings = pgTable(
  "seller_settings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("USD"),
    shippingOriginPostalCode: varchar("shipping_origin_postal_code", {
      length: 32,
    }),
    autoAcceptOrders: boolean("auto_accept_orders").notNull().default(true),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    supportEmail: varchar("support_email", { length: 255 }),
    supportPhone: varchar("support_phone", { length: 64 }),
    notificationPreferences: jsonb("notification_preferences").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("seller_settings_seller_id_idx").on(table.sellerId)],
);

// ==============================================================================
// 5. Seller Policies (Returns, Shipping, Terms, Privacy)
// ==============================================================================
export const sellerPolicies = pgTable(
  "seller_policies",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    policyType: varchar("policy_type", { length: 32 }).notNull(), // SHIPPING, RETURNS, PRIVACY, TERMS
    title: varchar("title", { length: 128 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("seller_policies_seller_id_idx").on(table.sellerId),
    index("seller_policies_type_idx").on(table.sellerId, table.policyType),
  ],
);

// ==============================================================================
// 6. Seller Status History (Audit Trail)
// ==============================================================================
export const sellerStatusHistory = pgTable(
  "seller_status_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    previousStatus: varchar("previous_status", { length: 32 }).notNull(),
    newStatus: varchar("new_status", { length: 32 }).notNull(),
    reason: text("reason").notNull(),
    changedByUserId: varchar("changed_by_user_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("seller_status_history_seller_id_idx").on(table.sellerId)],
);

// ==============================================================================
// 7. Seller Performance Snapshots
// ==============================================================================
export const sellerPerformanceSnapshots = pgTable(
  "seller_performance_snapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sellerId: varchar("seller_id", { length: 64 })
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
    totalReviews: integer("total_reviews").notNull().default(0),
    orderFulfillmentRate: numeric("order_fulfillment_rate", {
      precision: 5,
      scale: 2,
    }).default("100.00"),
    cancellationRate: numeric("cancellation_rate", {
      precision: 5,
      scale: 2,
    }).default("0.00"),
    totalOrdersCompleted: integer("total_orders_completed")
      .notNull()
      .default(0),
    responseTimeHours: numeric("response_time_hours", {
      precision: 5,
      scale: 2,
    }).default("24.00"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("seller_perf_seller_id_idx").on(table.sellerId)],
);

// ==============================================================================
// 8. Platform System Settings (Project-Wide Super Admin Controls)
// ==============================================================================
export const systemSettings = pgTable("system_settings", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. "marketplace"
  isSellerEnabled: boolean("is_seller_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: varchar("updated_by", { length: 128 }),
});

// ==============================================================================
// 9. Admin Delegations (Super Admin Delegated Verification Authority)
// ==============================================================================
export const adminDelegations = pgTable(
  "admin_delegations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    adminUserId: varchar("admin_user_id", { length: 128 }).notNull(),
    permission: varchar("permission", { length: 64 })
      .notNull()
      .default("manage_sellers"),
    grantedByUserId: varchar("granted_by_user_id", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("admin_delegations_user_idx").on(table.adminUserId)],
);
