# Review Service Performance & Composite Index Optimization

## Overview
`review-service` is an authoritative read/write engine for product reviews, verified purchases, helpful votes, and product rating summaries.

### Identified Bottlenecks
1. **Missing Composite Index on `reviews(product_id, status)`**:
   - Every product rating summary recalculation (`recalculateSummary`) and storefront review query filters by `where productId = ? and status = 'APPROVED'`.
   - The table previously only had single-column B-Tree indexes on `productId` and `status`. Under large datasets, PostgreSQL must scan all reviews for the product and filter out non-approved ones in memory, or perform multi-index bitmap merges with heap lookups.
   - Adding composite index `reviews_product_status_idx` on `(productId, status)` and `reviews_prod_status_created_idx` on `(productId, status, createdAt)` allows direct index-only scans and fast reverse-chronological pagination.
2. **Review Summary Cache Stampede / Thundering-Herd Risk**:
   - `SummaryService.getProductRatingSummary(productId)` is queried on every product detail page load.
   - When the Redis cache key expires or is invalidated during product review submission, multiple concurrent visitors generate simultaneous database read queries to `productRatingSummaries`.
   - Applying in-flight SingleFlight promise coalescing ensures that only one database query executes per `productId`, while all concurrent callers wait and share the resolved result.

## Target Architecture

### 1. Drizzle Schema Composite Indexes
- Add composite indexes in `apps/review-service/src/db/schema.ts`:
  - `reviews_product_status_idx` on `(table.productId, table.status)`
  - `reviews_prod_status_created_idx` on `(table.productId, table.status, table.createdAt)`

### 2. SingleFlight Coalescing in `SummaryService`
- In `apps/review-service/src/services/summary.service.ts`:
  - Maintain an in-memory `inFlightSummaries = new Map<string, Promise<ProductRatingSummary>>()`.
  - Cache misses coalesce onto a single shared promise and clean up in `finally`.

### 3. Verification & Safety
- Full unit tests in `apps/review-service/tests/review-summary.test.ts` verifying SingleFlight coalescing, composite index schema definitions, and recalculation formulas.
- Full monorepo typecheck validation across all 41 packages.

