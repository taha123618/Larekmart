# AGENTS.md — apps/review-service

Scope: `apps/review-service` only. Root rules still apply — start there.

## What this service is

Fastify 5 review microservice: product reviews, ratings, verified purchases, moderation,
helpful votes, and seller responses. Port 8014.

**Source-of-truth split (never mix these):**

- PostgreSQL (`review_db`, Drizzle ORM) — reviews, ratings, review_media attachments,
  review_votes, review_reports, moderation logs, seller responses, and purchase eligibility.
- Redis — rating summary cache (`review:summary:<productId>`) and anti-abuse vote/report rate limits.
  Never authoritative. Outages degrade read performance, never correctness.
- Kafka — asynchronously consumes order and catalog events (`order.delivered`, `order.completed`,
  `shipment.delivered`, `product.deleted`, `user.deleted`) to manage eligibility and integrity;
  publishes lifecycle events (`review.created`, `review.updated`, `review.deleted`, `review.approved`,
  `review.rejected`, `review.reported`, `product.rating-summary.updated`) using the repository envelope
  `producer.send(topic, { value: payload })`.

## Architecture & Layers

- `src/server.ts` & `src/index.ts` — Fastify 5 HTTP application with CORS, request logging, and graceful teardown.
- `src/db/` — Drizzle ORM schema (`schema.ts`), PostgreSQL connection pool (`connection.ts`), and idempotent migrations (`migrate.ts`).
- `src/repositories/` — Isolated data access layer for eligibility, reviews, votes, reports, moderation, and summaries.
- `src/services/` — Business logic:
  - `review.service.ts`: Enforces purchase verification, 1 review per product per customer, status transitions, and Kafka notifications.
  - `moderation.service.ts`: Hybrid moderation (auto-approves clean reviews from verified buyers; queues flagged reviews).
  - `summary.service.ts`: Aggregates 1-5 star distributions, calculates Bayesian/arithmetic averages, updates database summaries, caches in Redis, and publishes rating-summary events.
- `src/cache/` — Typed Redis cache client for rating summaries and fast invalidation.
- `src/consumers/` — Kafka consumers listening to `order.delivered` / `shipment.delivered` to record purchase eligibility, and cascade cleanups for deleted products/users.
- `src/publishers/` — Kafka producer publishing strongly-typed events to `@repo/kafka`.
- `src/middleware/` — Clerk JWT validation and gateway internal secret headers (`shouldBeUser`, `shouldBeAdmin`).

## Routes & Endpoints

- Public:
  - `GET /api/v1/products/:productId/reviews` or `GET /api/v1/reviews?productId=...` — paginated product reviews with sorting (`newest`, `highest_rating`, `lowest_rating`, `most_helpful`).
  - `GET /api/v1/products/:productId/rating-summary` or `GET /api/v1/reviews/products/:productId/rating-summary` — cached 1-5 star distribution, average rating, total reviews, and verified buyer count.
  - `GET /api/v1/reviews/:reviewId` — single review details with media attachments and seller response.
- Customer (`shouldBeUser`):
  - `POST /api/v1/products/:productId/reviews` or `POST /api/v1/reviews` — create review (strictly verifies purchase eligibility first).
  - `GET /api/v1/me/reviews` — customer's own reviews across all products.
  - `PATCH /api/v1/reviews/:reviewId` — update rating, title, or content.
  - `DELETE /api/v1/reviews/:reviewId` — delete own review (recalculates product rating summary).
  - `POST /api/v1/reviews/:reviewId/votes` — helpful or unhelpful vote (prevents duplicate votes and voting on own review).
  - `DELETE /api/v1/reviews/:reviewId/votes` — remove helpful vote.
  - `POST /api/v1/reviews/:reviewId/reports` — report abuse (SPAM, OFFENSIVE, HARASSMENT, FAKE_REVIEW, OFF_TOPIC).
  - `POST /api/v1/reviews/:reviewId/response` — 1:1 seller response to customer feedback.
- Admin (`shouldBeAdmin`):
  - `GET /api/v1/admin/reviews/pending` — moderation queue for flagged/pending reviews.
  - `POST /api/v1/admin/reviews/:reviewId/moderate` — approve, reject, or flag a review with audit trail.
  - `GET /api/v1/admin/reviews/reports` — review reports and abuse flags.
  - `POST /api/v1/admin/reviews/recalculate-summaries` — re-compute rating summaries across all products.
- Health:
  - `GET /health` — liveness check.
  - `GET /ready` — readiness check (verifies PostgreSQL and Redis connectivity).

## Testing & Quality

- Tests run with `pnpm --filter review-service test` using `tsx tests/review-service.test.ts`.
- No Vitest/Jest — uses Node assert and Fastify injection.
- Strict TypeScript: `strict`, `noUncheckedIndexedAccess: true`.
