---
name: review-lifecycle
description: Use when authoring, modifying, testing, or debugging product review workflows, verified purchase gating, moderation queues, helpful votes, rating summaries, or review events in review-service.
---

# Review Lifecycle & Reputation Playbook — review-service

This playbook covers the authoritative standards and execution patterns for `apps/review-service` (:8014).

## 1. Responsibilities & Boundaries

- **Authoritative Review Data**: Owns `reviews`, `review_media`, `review_votes`, `review_reports`, `review_moderation_actions`, `seller_responses`, and `product_rating_summaries` in PostgreSQL (`review_db`).
- **Verified Purchase Authority**: Maintains purchase eligibility table populated from consumed `order.delivered`, `order.completed`, and `shipment.delivered` Kafka events. Never trusts frontend claims of purchase status.
- **Anti-Abuse & Rate Limiting**:
  - Redis-backed sliding-window rate limits for review submissions and reports.
  - One helpful vote per user per review with atomic counter increment/decrement.
  - Automated flag threshold: when a review receives 5+ reports, status transitions to `FLAGGED` and triggers moderation events.
- **Async Cross-Service Communication**:
  - Emits: `review.created`, `review.updated`, `review.deleted`, `review.approved`, `review.rejected`, `review.reported`, and `product.rating-summary.updated`.
  - Consumes: `order.delivered`, `order.completed`, `shipment.delivered`, `product.deleted`, `user.deleted`.

## 2. API Routes

| Method   | Path                                         | Auth           | Purpose                                                                  |
| :------- | :------------------------------------------- | :------------- | :----------------------------------------------------------------------- |
| `GET`    | `/api/v1/products/:productId/reviews`        | Public         | Paginated product reviews (filterable by rating, verified status, media) |
| `GET`    | `/api/v1/products/:productId/rating-summary` | Public         | Average rating, total count, star distribution (Redis-cached)            |
| `POST`   | `/api/v1/products/:productId/reviews`        | User           | Submit new review (checks purchase eligibility)                          |
| `GET`    | `/api/v1/reviews/:reviewId`                  | Public         | Fetch individual review details                                          |
| `PATCH`  | `/api/v1/reviews/:reviewId`                  | Owner / User   | Update review title, body, or rating                                     |
| `DELETE` | `/api/v1/reviews/:reviewId`                  | Owner / Admin  | Delete review                                                            |
| `POST`   | `/api/v1/reviews/:reviewId/votes`            | User           | Upvote or downvote helpfulness                                           |
| `POST`   | `/api/v1/reviews/:reviewId/reports`          | User           | Report review for moderation                                             |
| `POST`   | `/api/v1/reviews/:reviewId/response`         | Seller / Admin | Add official seller response                                             |
| `GET`    | `/api/v1/admin/reviews/pending`              | Admin          | Review moderation queue                                                  |
| `POST`   | `/api/v1/admin/reviews/:reviewId/moderate`   | Admin          | Approve or reject review                                                 |
| `GET`    | `/health` / `/ready`                         | Public         | Health and readiness probes                                              |
| `GET`    | `/metrics`                                   | Public         | Prometheus scrape endpoint                                               |

## 3. Testing & Verification

Run the comprehensive offline test suites:

```bash
pnpm --filter review-service test
pnpm --filter review-service check-types
```
