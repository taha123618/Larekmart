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

---

## 4. Future AI/ML & Predictive Model Specifications

### 4.1 Recommendation Engine (Collaborative & Content-Based)

- **Model Objective**: Recommend relevant clothing items based on cart contents, selected color variants, and purchase history.
- **Input Features**: `product.category`, `product.colors`, `cart.items`, `user.past_orders`.
- **Target Metric**: Hit Rate@5 > 25%, Mean Reciprocal Rank (MRR) > 0.35.

### 4.2 Dynamic Search & Semantic Ranking

- **Model Objective**: Vector embeddings for natural language search queries (e.g. "warm winter jacket with hood").
- **Embedding Architecture**: Fast text embeddings over `Product.name`, `Product.shortDescription`, and `Product.description`.

### 4.3 Anomaly & Fraud Detection Model

- **Model Objective**: Identify anomalous payment attempts and abnormal purchase velocity before webhook confirmation.
- **Input Features**: `checkout.amount`, `checkout.item_count`, `user.creation_timestamp`, `event.interval`.
