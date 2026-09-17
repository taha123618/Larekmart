# Recommendation Service — AI Editor Implementation Prompt

## Role

Act as a **Principal Python Engineer, Machine Learning Engineer, and Distributed Systems Architect**.

You are responsible for designing and implementing the complete, production-grade **`recommendation-service`** for this microservices e-commerce platform.

Do not treat this as a basic CRUD API. Build it as a scalable, event-driven **recommendation and personalization platform** that can start with deterministic recommendation strategies and evolve toward machine-learning and vector-based recommendations without requiring a major architectural rewrite.

---

# 1. Project Context

This repository is a microservices-based e-commerce platform.

The recommendation service is responsible for:

- personalized product recommendations
- product similarity
- category recommendations
- trending products
- popular products
- frequently bought together
- recently viewed products
- user preference modeling
- recommendation ranking
- product embeddings
- user embeddings
- recommendation telemetry & feedback loops

---

# 2. Technology Stack

- **Runtime:** Python 3.12+ (managed with `uv`)
- **Web API:** FastAPI
- **Validation:** Pydantic v2 & pydantic-settings
- **Database:** PostgreSQL with `pgvector`
- **ORM:** SQLAlchemy 2.x async (`asyncpg` + `greenlet`)
- **Migrations:** Alembic
- **Caching:** Redis (`redis.asyncio`)
- **Messaging:** Kafka (`aiokafka`) with `{ value: payload }` envelope
- **Machine Learning & Numerics:** `scikit-learn`, `numpy`, `pandas`
- **Background Worker:** Celery with Redis broker
- **Observability:** Prometheus metrics (`/metrics`), OpenTelemetry tracing, `structlog`
- **Packaging:** `pyproject.toml` + `uv.lock`

---

# 3. Service Ownership & Boundaries

### Recommendation Service Owns:

- `user_interactions`: Granular interaction events, weights, and session telemetry
- `product_embeddings`: 128-dimensional vector embeddings, name, category, and metadata in pgvector
- `user_embeddings`: User aggregated preference vectors in pgvector
- `recommendation_models`: Model metadata, hyperparameters, and version metrics
- `recommendation_jobs`: Background calculation and model training logs
- `recommendation_analytics_events`: Impressions, clicks, and conversions
- `processed_events`: Event deduplication records
- Redis cache (`recommendations:*`): Real-time personalized, trending, popular, similar, and home feed shelves

The recommendation service **does not own** primary product catalog mutations or financial order transactions. It consumes Kafka events and provides recommendation APIs to client frontends and administrative dashboards.

---

# 4. Kafka Event Architecture

Consumes the following topics:

- `product.created`, `product.updated`, `product.deleted`
- `order.created`, `order.completed`, `payment.successful`
- `product.viewed`, `product.searched`, `product.added_to_cart`, `product.removed_from_cart`, `wishlist.product_added`
- `review.created`
- `recommendation.interaction`

Configurable interaction weights:

- `VIEW`: 1.0
- `SEARCH`: 1.0
- `WISHLIST`: 4.0
- `ADD_TO_CART`: 6.0
- `REMOVE_FROM_CART`: -2.0
- `ORDER_COMPLETED`: 10.0
- `REVIEW_CREATED`: 8.0

---

# 5. Recommendation Strategy Hierarchy

1. **Rule-Based**:
   - `TrendingStrategy`: Interaction velocity with exponential decay half-life
   - `PopularStrategy`: All-time engagement and purchase volume
   - `RecentlyViewedStrategy`: User's recent interaction history
   - `CategoryBasedStrategy`: Category-scoped popularity and engagement
2. **Collaborative Filtering**:
   - Item-item collaborative filtering using Pandas interaction matrices and Scikit-learn cosine similarity
3. **Content-Based & Vector-Based**:
   - Semantic product similarity using pgvector `<=>` cosine distance
   - Multi-attribute matching (category, brand, Jaccard tag similarity, price proximity)
4. **Hybrid Strategy & Ranking Pipeline**:
   - Weighted multi-objective scoring:
     $$Score = w_{collab} S_{collab} + w_{content} S_{content} + w_{emb} S_{emb} + w_{pop} S_{pop} + w_{fresh} S_{fresh}$$
   - Business constraint filters (active products only, out-of-stock exclusion, recent purchase exclusion)
5. **Cold Start Fallback Chain**:
   $$\text{Personalized} \longrightarrow \text{Category-Based} \longrightarrow \text{Similar} \longrightarrow \text{Trending} \longrightarrow \text{Global Best Sellers}$$

---

# 6. REST API Endpoints

- `GET /api/v1/recommendations/home`: Aggregated personalized, trending, and popular shelves
- `GET /api/v1/recommendations/personalized`: Personalized recommendations for a user
- `GET /api/v1/recommendations/product/{product_id}`: Product page recommendations
- `GET /api/v1/recommendations/similar/{product_id}`: Vector cosine nearest neighbors
- `GET /api/v1/recommendations/frequently-bought-together/{product_id}`: Co-purchased items
- `GET /api/v1/recommendations/category/{category_id}`: Category-filtered recommendations
- `GET /api/v1/recommendations/trending`: Velocity-based trending items
- `GET /api/v1/recommendations/popular`: Engagement-based popular items
- `GET /api/v1/recommendations/recently-viewed`: User's recently viewed products
- `GET /api/v1/products/{product_id}/embedding`: Stored vector embedding details
- `GET /api/v1/products/{product_id}/neighbors`: Raw vector nearest neighbors
- `GET /api/v1/users/{user_id}/preferences`: User category affinity and preference vector status
- `POST /api/v1/interactions`: Record user behavioral interaction
- `POST /api/v1/analytics/events`: Record recommendation impression, click, or conversion
- `GET /health`, `GET /health/live`, `GET /health/ready`: Liveness and readiness probes
- `GET /metrics`: Prometheus telemetry scrape endpoint
