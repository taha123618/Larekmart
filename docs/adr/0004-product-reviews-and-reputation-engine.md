# 4. Product Reviews, Reputation Engine & Verified Purchase Architecture

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Larekmart Core Engineering Team

## Context

Customer trust and product conversion in multi-vendor e-commerce marketplaces (such as Amazon, Daraz, AliExpress) depend critically on genuine product feedback, star ratings, and community reputation. The requirements include:

1. **Anti-Astroturfing & Verified Purchases**: Unverified reviews dilute trust. Review submissions must strictly prove that the reviewer placed an order containing the product, and that the item was successfully delivered.
2. **Review Integrity & Limits**: Exactly 1 review per product per verified buyer. Authors cannot upvote or report their own reviews.
3. **Decoupled Asynchronous Ingestion**: Order delivery events (`order.delivered`, `shipment.delivered`) happen asynchronously. The review system must ingest eligibility without synchronous HTTP calls to `order-service` or `shipping-service`.
4. **Fast Read Projections**: Frontends require instant rating summaries (average rating, count, star distribution) during catalog browsing without re-aggregating review rows on every request.
5. **Rich Media Integration**: Customers want photo attachments with direct-to-storage presigned uploads without routing heavy binaries through the review service.

## Decision

We designed and implemented a standalone microservice, **`apps/review-service`** (:8014), following these patterns:

1. **Runtime & Framework**: Fastify 5 for high-throughput, low-overhead HTTP routing, structured logging, and schema-validated endpoints.
2. **Data Ownership & Persistence**:
   - Dedicated PostgreSQL database (`review_db`) using Drizzle ORM for type-safe schema definitions and zero-overhead queries.
   - Tables: `reviews`, `review_media`, `review_votes`, `review_reports`, `review_moderation_actions`, `seller_responses`, `product_rating_summaries`, and `purchase_eligibility`.
3. **Verified Purchase Authority**:
   - Consumes `order.delivered`, `order.completed`, and `shipment.delivered` Kafka events to populate `purchase_eligibility` rows idempotently.
   - Rejects review creation with `403 Forbidden` if eligibility does not exist, and `409 Conflict` if the user already reviewed the product.
4. **Redis Cache-Aside**:
   - Product rating summaries are cached in Redis under the `review:summary:<productId>` key.
   - Write-through cache invalidation occurs immediately upon review creation, edit, deletion, or moderation.
5. **Decoupled Cross-Service Events**:
   - **Publishes**: `review.created`, `review.updated`, `review.deleted`, `review.approved`, `review.rejected`, `review.reported`, and `product.rating-summary.updated`.
   - **Downstream Consumers**:
     - `search-service`: updates OpenSearch documents (`rating`, `reviewCount`) in real time.
     - `catalog-service`: updates denormalized read-models in `catalog-db`.
     - `analytic-service`: updates live KPIs and event audit trails.
     - `notification-service`: alerts sellers on reviews and moderators on abuse reports.
     - `recommendation-service`: computes user-item interaction signals and collaborative embeddings.
6. **Media Pipeline Delegation**:
   - Review photo uploads leverage `media-service` (:8013) for presigned S3/MinIO upload sessions. `review-service` stores the resulting `mediaId` references.

## Consequences

### Positive

- Strict isolation: zero direct HTTP dependencies between `review-service` and other backend services.
- Sub-5ms cached rating summary queries for product pages and search grids.
- Verified purchase guarantees protect platform reputation against fake reviews.
- Clean moderation workflow with automated flagging at 5+ reports and admin moderation UI.

### Trade-offs

- An additional database (`review_db`) and service container to orchestrate in Kubernetes and Docker Compose.
- Temporary event lag between order delivery in shipping-service and eligibility availability in review-service (typically <100ms via Kafka).
