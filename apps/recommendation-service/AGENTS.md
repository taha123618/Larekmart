# AGENTS.md — apps/recommendation-service (AI Recommendations & Personalization Engine)

Scope: `apps/recommendation-service` only. Root rules (`AGENTS.md`) still apply — start there.

## What this service is

A high-performance hybrid recommendation platform for Larekmart built with Python 3.12+ (FastAPI), PostgreSQL with `pgvector` (128-dimensional dense vector embeddings), Redis read-through caching, and Kafka asynchronous event streaming. It combines collaborative filtering, pgvector cosine distance similarity, content-based affinity, exponential time-decay trending velocity, and popularity engagement ranking behind a multi-tier cold-start fallback cascade.

## Where things live

- `app/main.py` — FastAPI application factory, lifespan management, middleware, and router registration on port `8008`.
- `app/core/config.py` — Pydantic Settings reading environment variables from `.env`.
- `app/core/logging.py` — Structured logging configuration via `structlog`.
- `app/core/errors.py` — Global exception handlers returning standard `{ message }` JSON.
- `app/core/security.py` — Security headers and Clerk JWT validation helper.
- `app/db/session.py` — SQLAlchemy 2.x async engine (`asyncpg`) and sessionmaker.
- `app/db/models/` — Lean database domain models matching `001_initial_schema.py`:
  - `user_interaction.py` — User behavioral events (`VIEW`, `ADD_TO_CART`, `ORDER_COMPLETED`, etc.)
  - `product_embedding.py` — `pgvector` 128-dim dense product vectors with HNSW index
  - `user_embedding.py` — `pgvector` 128-dim user preference vectors
  - `recommendation_model.py` — Registered model metadata & evaluation metrics
  - `recommendation_job.py` — Asynchronous calculation job ledger
  - `processed_event.py` — Kafka consumer idempotency tracking
  - `recommendation_analytics_event.py` — Storefront impression and click telemetry
- `app/repositories/` — Async database access queries:
  - `interaction_repository.py` — Trending calculations, popularity aggregates, interaction recording
  - `embedding_repository.py` — `pgvector` nearest-neighbor cosine similarity queries (`<=>`)
  - `event_repository.py` — Idempotency check & mark
- `app/services/` — Business logic:
  - `recommendation_service.py` — Multi-candidate generation, hybrid scoring, cold-start cascade
  - `interaction_service.py` — Telemetry ingestion and cache invalidation
- `app/cache/redis.py` — Async Redis cache helper with TTL and key prefixing.
- `app/messaging/` — Kafka event streaming:
  - `kafka.py` — Global `aiokafka` consumer and producer manager
  - `consumers/event_consumer.py` — Registers Kafka handlers for `product.*`, `order.*`, `payment.*`, and `review.*`
- `app/workers/` — Celery background processing:
  - `celery.py` — Celery application configuration with Redis broker
  - `embedding_tasks.py` — Background vector generation
  - `recommendation_tasks.py` — Precomputed trending and popular cache warming
  - `training_tasks.py` — Offline collaborative model metadata registration and log retention cleanup
- `app/observability/metrics.py` — Prometheus metric collectors exposed on `/metrics`.
- `tests/` — Full pytest test suite covering API, embeddings, hybrid ranking, vector similarity, and E2E flows.

## Boundaries & Golden Rules

1. **Single Source of Truth**: The catalog is owned by `product-service` (Postgres) and orders are owned by `order-service` (MongoDB). This service only stores interaction telemetry and pgvector embeddings. Never create redundant `products` or `users` tables.
2. **Kafka Asynchronous Integration**: Catalog updates and purchase completions are ingested exclusively via Kafka topics (`product.created`, `product.updated`, `product.deleted`, `payment.successful`, `order.created`). Never make HTTP calls from backend services into `recommendation-service`.
3. **Graceful Fallbacks**: If a user has no interaction history (cold start) or Redis/Celery is degraded, recommendations gracefully cascade: `Personalized ➔ Category-Based ➔ Similar Products ➔ Trending ➔ Popular`.

## Local Commands

Run from `apps/recommendation-service`:

```bash
uv sync                                     # install / sync virtual environment
uv run pytest tests/                        # run full pytest test suite
uv run alembic upgrade head                 # apply migrations
uv run uvicorn app.main:app --port 8008     # run API server
```

Run from repository root:

```bash
pnpm check-types                            # verify whole monorepo
```
