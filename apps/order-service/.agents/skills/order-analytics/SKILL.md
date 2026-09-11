---
name: order-analytics
description: Use when modifying MongoDB order aggregation pipelines, 6-month sales summaries, or chart analytics endpoints in apps/order-service.
---

# Order Analytics & Aggregation Pipelines

Guidance for order reporting and analytics in `apps/order-service`.

## 1. Aggregation Endpoint (`GET /order-chart`)

- Guarded by `shouldBeAdmin` middleware via `@clerk/fastify`.
- Aggregates orders placed within the last 6 months.

## 2. MongoDB Aggregation Pipeline

- Filters documents by `createdAt >= sixMonthsAgo`.
- Groups by month using `$month: "$createdAt"` and status (`success | failed`).
- Sums monetary amounts (`$sum: "$amount"`) and counts orders (`$sum: 1`).
- Formats month numbers into month names (`Jan`, `Feb`, etc.) using `date-fns`.

## 3. Output Schema (`OrderChartType`)

- Returns array compatible with admin dashboard Recharts components:
  ```ts
  {
    month: string;
    total: number;
    successful: number;
  }
  [];
  ```
