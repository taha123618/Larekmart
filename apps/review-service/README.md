# @repo/review-service

High-performance product reviews, ratings, verified purchase validation, moderation, and helpful votes microservice for the Larekmart platform.

## Architecture

- **Runtime**: Node.js 22 LTS
- **Framework**: Fastify 5
- **Database**: PostgreSQL (`review_db`) managed with Drizzle ORM
- **Cache**: Redis (`@repo/redis`) with prefix `review:`
- **Event Bus**: Apache Kafka (`@repo/kafka`)
- **Authentication**: Clerk JWT & Api-Gateway Internal Secret Delegation (`@repo/types`)
- **Default Port**: `8014`

## Features

1. **Verified Purchase Reviews**:
   - Asynchronously consumes `order.delivered` / `shipment.delivered` Kafka events to track purchased product eligibility.
   - Strictly enforces that only verified customers who purchased the item can submit a review.
   - Enforces 1 review per product per user.
2. **Ratings & Rich Feedback**:
   - 1 to 5 star ratings.
   - Review title, markdown written feedback, and optional media attachments referencing `media-service` asset IDs.
3. **Helpful Voting System**:
   - Helpful / Unhelpful community votes.
   - Prevents authors from voting on their own reviews.
   - Atomic upvote/downvote transitions and idempotency.
4. **Abuse Reporting & Moderation**:
   - Customer reporting for spam, offensive content, harassment, or fake reviews.
   - Hybrid automated/manual moderation workflow.
   - Admin moderation queue and audit logging.
5. **Real-time Rating Summaries**:
   - Product-level rating summaries: average rating, total reviews, verified purchase count, and star distribution (1–5).
   - Redis caching with write-through invalidation and background Kafka broadcasts on updates.
6. **Seller Responses**:
   - Verified sellers can publish official 1:1 responses to customer reviews.

## Commands

```bash
# Development
pnpm --filter review-service dev

# Type check
pnpm --filter review-service check-types

# Run tests
pnpm --filter review-service test

# Database migrations
pnpm --filter review-service db:migrate
```
