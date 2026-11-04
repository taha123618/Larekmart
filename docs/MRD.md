# Model Requirement Document (MRD) — Larekmart E-Commerce Platform

## 1. Scope & Purpose

This document defines the **domain models, entity-relationship schemas, shared contracts, and future predictive/AI model requirements** across the Larekmart ecosystem.

---

## 2. Polyglot Persistence & Data Models

### 2.1 Relational Catalog Model — PostgreSQL / Prisma (`@repo/product-db`)

```prisma
model Product {
  id               Int      @id @default(autoincrement())
  name             String
  slug             String   @unique
  shortDescription String
  description      String
  price            Float
  sizes            String[]
  colors           String[]
  images           Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  category         Category @relation(fields: [categoryId], references: [id])
  categoryId       Int
}

model Category {
  id        Int       @id @default(autoincrement())
  name      String
  slug      String    @unique
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### 2.2 Document Order Model — MongoDB / Mongoose (`@repo/order-db`)

```typescript
export interface OrderSchemaType {
  userId: string;
  email: string;
  amount: number; // in cents
  status: "success" | "failed";
  products: {
    name: string;
    quantity: number;
    price: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 Analytics & Time-Series Models — PostgreSQL (`apps/analytic-service`)

```sql
-- Raw immutable event audit log
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id VARCHAR(255),
  amount NUMERIC(12, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily aggregated rollup
CREATE TABLE analytics_daily_summary (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_revenue NUMERIC(14, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_signups INT DEFAULT 0,
  total_products_created INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 Commission Engine Relational Models — PostgreSQL / Drizzle (`apps/commission-service`)

```typescript
// Core Commission Engine Schema (larekmart_commission_db)
export const commissionPlans = pgTable("commission_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const commissionRules = pgTable("commission_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id")
    .references(() => commissionPlans.id)
    .notNull(),
  scope: varchar("scope", { length: 50 }).notNull(), // GLOBAL | CATEGORY | SELLER | PRODUCT
  scopeId: varchar("scope_id", { length: 255 }),
  ratePercentage: numeric("rate_percentage", {
    precision: 7,
    scale: 4,
  }).notNull(),
  fixedFee: numeric("fixed_fee", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  minFee: numeric("min_fee", { precision: 12, scale: 2 }),
  maxFee: numeric("max_fee", { precision: 12, scale: 2 }),
  version: integer("version").default(1).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true })
    .defaultNow()
    .notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
});

export const commissionRuleVersions = pgTable("commission_rule_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ruleId: uuid("rule_id")
    .references(() => commissionRules.id)
    .notNull(),
  version: integer("version").notNull(),
  ratePercentage: numeric("rate_percentage", {
    precision: 7,
    scale: 4,
  }).notNull(),
  fixedFee: numeric("fixed_fee", { precision: 12, scale: 2 }).notNull(),
  minFee: numeric("min_fee", { precision: 12, scale: 2 }),
  maxFee: numeric("max_fee", { precision: 12, scale: 2 }),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
});
```

### 2.5 Double-Entry Financial Ledger & Payout Models — PostgreSQL / Drizzle (`apps/payout-service`)

```typescript
// Balanced Double-Entry Accounting Journal (larekmart_payout_db)
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: varchar("seller_id", { length: 255 }),
  accountType: varchar("account_type", { length: 50 }).notNull(), // ESCROW | AVAILABLE | PAYOUT | EXPENSE | REVENUE
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull(), // Shared across balanced debit/credit pair
  accountId: uuid("account_id")
    .references(() => ledgerAccounts.id)
    .notNull(),
  entryType: varchar("entry_type", { length: 10 }).notNull(), // DEBIT | CREDIT
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  referenceType: varchar("reference_type", { length: 50 }).notNull(), // ORDER | PAYOUT | REFUND | DISPUTE
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: varchar("seller_id", { length: 255 }).notNull(),
  batchId: uuid("batch_id").references(() => payoutBatches.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // PENDING | PROCESSING | PAID | FAILED
  provider: varchar("provider", { length: 50 })
    .default("STRIPE_CONNECT")
    .notNull(),
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

## 3. Shared Contract Models (`@repo/types`)

| Type Name                 | Purpose                          | Key Fields                                                            |
| :------------------------ | :------------------------------- | :-------------------------------------------------------------------- |
| `ProductType`             | Frontend & service product shape | `id`, `name`, `slug`, `price`, `sizes`, `colors`, `images`            |
| `OrderType`               | Frontend & service order record  | `_id`, `userId`, `email`, `amount`, `status`, `products`              |
| `CartItemType`            | In-memory shopping cart item     | `id`, `name`, `price`, `quantity`, `size`, `color`, `image`           |
| `AnalyticsSummaryType`    | Live platform KPIs               | `totalRevenue`, `totalOrders`, `totalSignups`, `totalProductsCreated` |
| `AnalyticsDailyChartType` | Daily rollup series              | `date`, `total_revenue`, `total_orders`, `total_signups`              |
| `AnalyticsEventType`      | Audit event stream               | `id`, `event_type`, `user_id`, `amount`, `metadata`, `created_at`     |
| `CommissionQuoteType`     | Line-item fee calculation quote  | `orderId`, `totalCommission`, `lineItems`, `currency`, `calculatedAt` |
| `CommissionPlanType`      | Configurable fee schedule        | `id`, `name`, `rules`, `isDefault`, `status`                          |
| `PayoutRecordType`        | Seller disbursement entity       | `id`, `sellerId`, `batchId`, `amount`, `status`, `provider`           |
| `LedgerAccountType`       | Financial chart of accounts      | `id`, `sellerId`, `accountType`, `currency`, `status`                 |
| `LedgerEntryType`         | Balanced double-entry posting    | `id`, `transactionId`, `accountId`, `entryType`, `amount`, `refId`    |

---

## 4. Future AI/ML & Predictive Model Specifications

### 4.1 Recommendation Engine (Collaborative & Content-Based)

- **Model Objective**: Recommend relevant products and marketplace items based on cart contents, selected color variants, and purchase history.
- **Input Features**: `product.category`, `product.colors`, `cart.items`, `user.past_orders`.
- **Target Metric**: Hit Rate@5 > 25%, Mean Reciprocal Rank (MRR) > 0.35.

### 4.2 Dynamic Search & Semantic Ranking

- **Model Objective**: Vector embeddings for natural language search queries (e.g. "warm winter jacket with hood").
- **Embedding Architecture**: Fast text embeddings over `Product.name`, `Product.shortDescription`, and `Product.description`.

### 4.3 Anomaly & Fraud Detection Model

- **Model Objective**: Identify anomalous payment attempts and abnormal purchase velocity before webhook confirmation.
- **Input Features**: `checkout.amount`, `checkout.item_count`, `user.creation_timestamp`, `event.interval`.
