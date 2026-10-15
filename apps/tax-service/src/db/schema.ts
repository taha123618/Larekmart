import {
  mysqlTable,
  varchar,
  decimal,
  boolean,
  int,
  timestamp,
  text,
} from "drizzle-orm/mysql-core";

/**
 * 1. tax_jurisdictions
 * Countries, regions, municipalities, and jurisdiction identifiers
 */
export const taxJurisdictions = mysqlTable("tax_jurisdictions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  countryCode: varchar("country_code", { length: 3 }).notNull(),
  regionCode: varchar("region_code", { length: 20 }),
  municipality: varchar("municipality", { length: 100 }),
  jurisdictionCode: varchar("jurisdiction_code", { length: 50 })
    .notNull()
    .unique(),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 2. tax_categories
 * Tax treatment classifications used by the tax engine (e.g. standard, clothing, groceries)
 */
export const taxCategories = mysqlTable("tax_categories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 3. tax_rules
 * Tax rates, conditions, calculation methods, and effective dates
 */
export const taxRules = mysqlTable("tax_rules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jurisdictionId: varchar("jurisdiction_id", { length: 36 })
    .notNull()
    .references(() => taxJurisdictions.id),
  categoryId: varchar("category_id", { length: 36 })
    .notNull()
    .references(() => taxCategories.id),
  rate: decimal("rate", { precision: 10, scale: 6 }).notNull(), // e.g. "0.082500"
  isInclusive: boolean("is_inclusive").notNull().default(false),
  priority: int("priority").notNull().default(1),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  version: varchar("version", { length: 50 }).notNull().default("2026-10"),
  calculationMethod: varchar("calculation_method", { length: 20 })
    .notNull()
    .default("percentage"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 4. tax_exemptions
 * Supported exemption types, certificates, and applicable customer/jurisdiction rules
 */
export const taxExemptions = mysqlTable("tax_exemptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  customerId: varchar("customer_id", { length: 100 }),
  exemptionCertificate: varchar("exemption_certificate", {
    length: 100,
  }).notNull(),
  exemptionType: varchar("exemption_type", { length: 50 }).notNull(), // wholesale, government, diplomatic, charity, educational
  jurisdictionId: varchar("jurisdiction_id", { length: 36 }).references(
    () => taxJurisdictions.id,
  ),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 5. tax_calculations
 * Calculation reference, input snapshot, result, and rule/provider version
 */
export const taxCalculations = mysqlTable("tax_calculations", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. tax_calc_123
  referenceType: varchar("reference_type", { length: 20 })
    .notNull()
    .default("quote"), // quote, order, return, invoice
  referenceId: varchar("reference_id", { length: 100 }),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  subtotal: decimal("subtotal", { precision: 12, scale: 4 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 12, scale: 4 }).notNull(),
  total: decimal("total", { precision: 12, scale: 4 }).notNull(),
  ruleVersion: varchar("rule_version", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull().default("standard"),
  inputSnapshot: text("input_snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 6. tax_calculation_lines
 * Per-line taxable amount, rate, and itemized tax breakdown
 */
export const taxCalculationLines = mysqlTable("tax_calculation_lines", {
  id: varchar("id", { length: 64 }).primaryKey(),
  calculationId: varchar("calculation_id", { length: 64 })
    .notNull()
    .references(() => taxCalculations.id),
  lineId: varchar("line_id", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }),
  categoryId: varchar("category_id", { length: 36 }),
  taxableAmount: decimal("taxable_amount", {
    precision: 12,
    scale: 4,
  }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 6 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 4 }).notNull(),
  jurisdictionCode: varchar("jurisdiction_code", { length: 50 }).notNull(),
  isInclusive: boolean("is_inclusive").notNull().default(false),
  breakdown: text("breakdown"), // JSON array of itemized jurisdiction rates (state, county, city)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 7. tax_provider_logs
 * Provider requests, responses, status, latency, and reconciliation information
 */
export const taxProviderLogs = mysqlTable("tax_provider_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(),
  requestPayload: text("request_payload").notNull(),
  responsePayload: text("response_payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  latencyMs: int("latency_ms").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaxJurisdiction = typeof taxJurisdictions.$inferSelect;
export type NewTaxJurisdiction = typeof taxJurisdictions.$inferInsert;

export type TaxCategory = typeof taxCategories.$inferSelect;
export type NewTaxCategory = typeof taxCategories.$inferInsert;

export type TaxRule = typeof taxRules.$inferSelect;
export type NewTaxRule = typeof taxRules.$inferInsert;

export type TaxExemption = typeof taxExemptions.$inferSelect;
export type NewTaxExemption = typeof taxExemptions.$inferInsert;

export type TaxCalculationRecord = typeof taxCalculations.$inferSelect;
export type NewTaxCalculationRecord = typeof taxCalculations.$inferInsert;

export type TaxCalculationLineRecord = typeof taxCalculationLines.$inferSelect;
export type NewTaxCalculationLineRecord =
  typeof taxCalculationLines.$inferInsert;

export type TaxProviderLog = typeof taxProviderLogs.$inferSelect;
export type NewTaxProviderLog = typeof taxProviderLogs.$inferInsert;
