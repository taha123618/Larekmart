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
// 1. Price Lists (B2C, B2B, Regional, Seller-Specific)
// ==============================================================================
export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    type: varchar("type", { length: 16 }).default("b2c").notNull(), // 'b2c' | 'b2b'
    sellerId: varchar("seller_id", { length: 64 }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_lists_code_idx").on(table.code),
    index("price_lists_type_idx").on(table.type),
    index("price_lists_is_default_idx").on(table.isDefault),
    index("price_lists_seller_idx").on(table.sellerId),
  ],
);

// ==============================================================================
// 2. Product Base Prices
// ==============================================================================
export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    priceListId: uuid("price_list_id")
      .references(() => priceLists.id, { onDelete: "cascade" })
      .notNull(),
    productId: varchar("product_id", { length: 64 }).notNull(),
    basePrice: numeric("base_price", { precision: 12, scale: 4 }).notNull(),
    minPrice: numeric("min_price", { precision: 12, scale: 4 }),
    maxPrice: numeric("max_price", { precision: 12, scale: 4 }),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 4 }),
    costPrice: numeric("cost_price", { precision: 12, scale: 4 }),
    isActive: boolean("is_active").default(true).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_prices_unique_idx").on(
      table.priceListId,
      table.productId,
    ),
    index("product_prices_product_id_idx").on(table.productId),
    index("product_prices_price_list_idx").on(table.priceListId),
  ],
);

// ==============================================================================
// 3. Variant Specific Prices (Overrides base product price if present)
// ==============================================================================
export const variantPrices = pgTable(
  "variant_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productPriceId: uuid("product_price_id")
      .references(() => productPrices.id, { onDelete: "cascade" })
      .notNull(),
    variantId: varchar("variant_id", { length: 64 }).notNull(),
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 4 }),
    costPrice: numeric("cost_price", { precision: 12, scale: 4 }),
    sku: varchar("sku", { length: 64 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("variant_prices_unique_idx").on(
      table.productPriceId,
      table.variantId,
    ),
    index("variant_prices_variant_id_idx").on(table.variantId),
  ],
);

// ==============================================================================
// 4. Price Rules (Volume tiers, bulk discounts, customer group pricing)
// ==============================================================================
export const priceRules = pgTable(
  "price_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    priceListId: uuid("price_list_id")
      .references(() => priceLists.id, { onDelete: "cascade" })
      .notNull(),
    ruleType: varchar("rule_type", { length: 32 }).notNull(), // 'tier' | 'bulk' | 'customer_group'
    productId: varchar("product_id", { length: 64 }),
    variantId: varchar("variant_id", { length: 64 }),
    minQuantity: integer("min_quantity").default(1).notNull(),
    maxQuantity: integer("max_quantity"),
    discountType: varchar("discount_type", { length: 32 }).notNull(), // 'percentage' | 'fixed_amount' | 'override_price'
    discountValue: numeric("discount_value", {
      precision: 12,
      scale: 4,
    }).notNull(),
    priority: integer("priority").default(0).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_rules_product_idx").on(table.productId),
    index("price_rules_price_list_idx").on(table.priceListId),
    index("price_rules_rule_type_idx").on(table.ruleType),
  ],
);

// ==============================================================================
// 5. Price Audit History
// ==============================================================================
export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productPriceId: uuid("product_price_id")
      .references(() => productPrices.id, { onDelete: "cascade" })
      .notNull(),
    variantPriceId: varchar("variant_price_id", { length: 64 }),
    oldPrice: numeric("old_price", { precision: 12, scale: 4 }).notNull(),
    newPrice: numeric("new_price", { precision: 12, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    changeReason: text("change_reason").notNull(),
    changedBy: varchar("changed_by", { length: 64 }).notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_history_product_price_idx").on(table.productPriceId),
    index("price_history_changed_at_idx").on(table.changedAt),
  ],
);

// ==============================================================================
// 6. Price Quotes (Immutable snapshots for cart, checkout & orders)
// ==============================================================================
export const priceQuotes = pgTable(
  "price_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: varchar("quote_id", { length: 64 }).notNull().unique(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    items: jsonb("items").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 4 }).notNull(),
    totalDiscount: numeric("total_discount", { precision: 12, scale: 4 })
      .default("0.0000")
      .notNull(),
    promotionDiscount: numeric("promotion_discount", {
      precision: 12,
      scale: 4,
    })
      .default("0.0000")
      .notNull(),
    finalTotal: numeric("final_total", { precision: 12, scale: 4 }).notNull(),
    customerGroup: varchar("customer_group", { length: 32 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("price_quotes_quote_id_idx").on(table.quoteId),
    index("price_quotes_expires_at_idx").on(table.expiresAt),
  ],
);

// ==============================================================================
// 7. Currency Exchange Rates
// ==============================================================================
export const currencyRates = pgTable(
  "currency_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baseCurrency: varchar("base_currency", { length: 3 })
      .default("USD")
      .notNull(),
    targetCurrency: varchar("target_currency", { length: 3 }).notNull(),
    exchangeRate: numeric("exchange_rate", {
      precision: 14,
      scale: 6,
    }).notNull(),
    autoRefresh: boolean("auto_refresh").default(true).notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("currency_rates_pair_idx").on(
      table.baseCurrency,
      table.targetCurrency,
    ),
    index("currency_rates_target_idx").on(table.targetCurrency),
  ],
);
