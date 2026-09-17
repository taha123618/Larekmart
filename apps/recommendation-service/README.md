# Larekmart Recommendation Service

A high-performance, event-driven recommendation and personalization microservice for the Larekmart e-commerce platform.

## Architecture

The service combines multiple recommendation strategies in a multi-stage candidate generation and hybrid ranking pipeline:

```
FastAPI /api/v1/recommendations/*
               │
               ▼
   [Redis Read-Through Cache]
        (Hit: Return JSON)
               │ (Miss)
               ▼
   [Candidate Generation Pool]
   ├── Collaborative Filtering (Interaction History)
   ├── Vector Semantic Similarity (pgvector Cosine Distance <=> 128-dim)
   ├── Content-Based (Category & Brand Affinity)
   ├── Trending Velocity (Decay Window)
   └── Popular / Best Sellers (Engagement Volume)
               │
               ▼
   [Hybrid Scorer & Ranker]
   W_collab(0.35) + W_content(0.25) + W_emb(0.20) + W_pop(0.10) + W_freshness(0.10)
               │
               ▼
   [Cold-Start Fallback Cascade]
   Personalized ➔ Category-Based ➔ Similar Products ➔ Trending ➔ Popular
               │
               ▼
   [Redis Cache Set & Response]
```

## Key Technologies

- **Runtime**: Python 3.12+ (managed with `uv`)
- **Web Framework**: FastAPI, Pydantic v2
- **Persistence**: PostgreSQL with SQLAlchemy 2.x async ORM (`asyncpg`) & Alembic migrations
- **Vector Search**: `pgvector` (128-dimensional dense vectors with cosine distance `<=>`)
- **Cache**: Redis with TTL expiration and namespace invalidation
- **Event Streaming**: Kafka via `aiokafka` (listening to `product.created`, `product.updated`, `payment.successful`, `order.created`, `product.viewed`)
- **Background Worker**: Celery with Redis broker/backend
- **ML / NLP**: Scikit-Learn L2-normalized feature hashing vectorizer (zero-leak, deterministic 128-dim embeddings)
- **Observability**: Prometheus metrics (`/metrics`), OpenTelemetry tracing, Structured JSON logging (`structlog`)

## Port Assignment

- **Recommendation Service**: Port `8008` (REST API & Prometheus metrics)

## API Endpoints

### Recommendations

- `GET /api/v1/recommendations/home?userId={id}&limit=10`
- `GET /api/v1/recommendations/personalized?userId={id}&limit=10`
- `GET /api/v1/recommendations/trending?limit=10&windowHours=48&categorySlug={cat}`
- `GET /api/v1/recommendations/popular?limit=10&categorySlug={cat}`
- `GET /api/v1/recommendations/similar/{productId}?limit=10`
- `GET /api/v1/recommendations/product/{productId}?limit=10`
- `GET /api/v1/recommendations/frequently-bought-together/{productId}?limit=5`
- `GET /api/v1/recommendations/category/{categoryId}?limit=10`
- `GET /api/v1/recommendations/recently-viewed?userId={id}&limit=10`

### Interactions

- `POST /api/v1/interactions` (records VIEW, ADD_TO_CART, WISHLIST, SEARCH, ORDER_COMPLETED)
- `GET /api/v1/interactions/user/{userId}`

### Analytics & Telemetry

- `POST /api/v1/analytics/events` (tracks IMPRESSION, CLICK, ADD_TO_CART, PURCHASE)
- `GET /api/v1/analytics/metrics` (CTR and conversion rates per strategy)

### Health & Metrics

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics` (Prometheus)

## Running Locally

```bash
# Setup virtual environment and install dependencies
uv sync

# Run tests
uv run pytest

# Run database migrations
uv run alembic upgrade head

# Start API server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8008 --reload

# Start Celery worker
uv run celery -A app.workers.celery worker --loglevel=info
```
