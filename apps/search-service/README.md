# Search Service (`apps/search-service`)

**`search-service`** is a dedicated, production-grade search and indexing microservice for Larekmart built with **Node.js**, **Fastify**, **OpenSearch**, **Redis**, and **Kafka**.

It decouples search and complex query loads from the transactional `product-service`, maintaining an optimized, denormalized catalog search index synchronized in real-time via Kafka domain events.

---

## Features

- **Full-Text Product Search**: Multi-match relevance search with configurable field boosting (`name^4`, `sku^3.5`, `brand^2`, `category^2`, `tags^1.5`, `description^1`), fuzziness, and phrase matching.
- **Faceted Navigation & Filtering**: Filter by category, price range, color, size, availability, rating, brand, tags, and seller, alongside real-time facet bucket counts and price statistics.
- **Dynamic Sorting**: Relevance (`_score`), price (`price_asc`, `price_desc`), newest (`createdAt`), customer rating, popularity, and discount percentage.
- **Autocomplete & Search Suggestions**: Sub-50ms prefix and edge-ngram suggestion search (`/api/v1/search/suggestions?q=...`).
- **Two-Tier Redis Caching**: Normalized query hash caching with logical namespace invalidation (`search:v1:<version>:<hash>`), built on `@repo/redis`.
- **Real-Time Event Synchronization**: Consumes `product.created`, `product.updated`, and `product.deleted` from Kafka with idempotent processing.
- **Zero-Downtime Reindexing**: Alias-based index switching mechanism (`products-v*` -> `products`) via `/api/v1/index/reindex`.
- **Observability**: OpenTelemetry tracing hooks, Prometheus `/metrics` endpoint, and `@repo/monitoring` structured JSON logging.
- **Resilient Health & Readiness**: Separate `/health` (liveness) and `/ready` (dependency checks for OpenSearch and Redis) endpoints.
- **Rate Limiting**: Fixed-window Redis rate limiter (`@repo/redis`) on public search and administrative reindexing routes.

---

## Architecture

```text
               product-service
                      │
                      ├── product.created
                      ├── product.updated
                      └── product.deleted
                      │
                      ▼
                    Kafka
                      │
                      ▼
               search-service (Fastify on port 8006)
               │
               ├── Product Events Consumer (Idempotent Indexing)
               ├── OpenSearch Engine (Index: products-v1, Alias: products) via @repo/opensearch
               ├── Redis (Search Query Cache & Rate Limiting)
               └── Observability (Prometheus Metrics & OpenTelemetry)
```

---

## API Endpoints

### 1. Product Search

`GET /api/v1/search`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | Search query text |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max: 100) |
| `sort` | enum | `relevance` | `relevance`, `price_asc`, `price_desc`, `newest`, `oldest`, `rating`, `popularity`, `discount` |
| `categorySlug` | string | — | Filter by category slug |
| `brand` | string | — | Filter by brand name |
| `min_price` | number | — | Minimum price in cents/dollars |
| `max_price` | number | — | Maximum price in cents/dollars |
| `color` | string | — | Filter by color(s); comma-separated or repeated for multi-select (`black,blue`) |
| `size` | string | — | Filter by size(s); comma-separated or repeated for multi-select (`m,l`) |
| `inStock` | boolean | — | Filter in-stock products |
| `rating` | number | — | Minimum rating (0-5) |

**Sample Request:**

```bash
curl "http://localhost:8006/api/v1/search?q=shirt&color=black,blue&size=m,l&min_price=10&sort=price_asc"
```

`color` and `size` are **multi-select**: values are normalized to lowercased, de-duplicated
lists and match **any** of the supplied values (OR within the facet), while different facets
still AND together. Facet counts are multi-select aware — choosing a color leaves the other
color buckets visible while narrowing the rest.

**Sample Response:**

```json
{
  "data": [
    {
      "id": "1",
      "sku": "SKU-1",
      "slug": "classic-black-tee",
      "name": "Classic Black Tee",
      "shortDescription": "Soft premium cotton tee",
      "description": "Essential crewneck crafted with 100% organic cotton.",
      "brand": "Larekmart",
      "category": "T-Shirts",
      "categorySlug": "t-shirts",
      "price": 2999,
      "sizes": ["s", "m", "l", "xl"],
      "colors": ["black"],
      "images": { "black": "https://example.com/black.jpg" },
      "inStock": true,
      "rating": 4.8,
      "reviewCount": 42,
      "isActive": true,
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-10T00:00:00.000Z"
    }
  ],
  "meta": {
    "query": "shirt",
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1,
    "took": 12,
    "fromCache": false
  },
  "facets": {
    "categories": [{ "key": "t-shirts", "doc_count": 1 }],
    "colors": [{ "key": "black", "doc_count": 1 }],
    "sizes": [
      { "key": "m", "doc_count": 1 },
      { "key": "l", "doc_count": 1 }
    ],
    "brands": [{ "key": "Larekmart", "doc_count": 1 }],
    "price_stats": { "min": 2999, "max": 2999, "avg": 2999 }
  }
}
```

---

### 2. Autocomplete Suggestions

`GET /api/v1/search/suggestions`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Query prefix (min length: 1) |
| `limit` | number | `5` | Maximum suggestions (max: 20) |

**Sample Request:**

```bash
curl "http://localhost:8006/api/v1/search/suggestions?q=tee"
```

Suggestions are **rich**: each hit carries the indexed product fields so clients can
render a thumbnail and deep-link to the product detail page.

**Sample Response:**

```json
{
  "data": [
    {
      "id": "42",
      "name": "Classic Black Tee",
      "slug": "classic-black-tee",
      "brand": "Larekmart",
      "category": "T-shirts",
      "categorySlug": "t-shirts",
      "price": 29.99,
      "images": { "black": "/products/1bl.png" }
    }
  ],
  "took": 4,
  "fromCache": true
}
```

---

### 3. Reindexing (Admin)

`POST /api/v1/index/reindex`

Requires Clerk session with `role: "admin"`.

**Request Body:**

```json
{
  "batchSize": 500,
  "recreateAlias": true
}
```

This copies documents between indices (zero-downtime alias swap) but does **not** refetch
product data. Documents written before `product.created` carried the full product are
missing `images`, `sizes`, and `colors` — and therefore their thumbnails and color/size
facets. To rebuild them, replay the catalog from the source of truth:

```bash
pnpm --filter product-service backfill:search
```

That republishes every product as `product.updated`, which this service's existing consumer
applies as an upsert. No database access or direct indexing is needed here. The same sweep
is available from the admin dashboard's **Rebuild search index** action
(`POST /products/backfill-search`, admin-only and windowed).

---

### 4. Health, Readiness & Metrics

- `GET /health` — Liveness check (200 OK)
- `GET /ready` — Readiness check (200 if OpenSearch and Redis are accessible)
- `GET /metrics` — Prometheus metrics format

---

## Local Development

```bash
# From repository root
pnpm --filter search-service dev

# Type check
pnpm --filter search-service check-types

# Build
pnpm --filter search-service build
```

---

## Environment Variables

| Variable                       | Default                                        | Description                                |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| `PORT`                         | `8006`                                         | HTTP listening port                        |
| `HOST`                         | `0.0.0.0`                                      | HTTP bind address                          |
| `OPENSEARCH_NODE`              | `http://localhost:9200`                        | OpenSearch endpoint                        |
| `OPENSEARCH_USERNAME`          | —                                              | OpenSearch username                        |
| `OPENSEARCH_PASSWORD`          | —                                              | OpenSearch password                        |
| `OPENSEARCH_INDEX`             | `products-v1`                                  | Initial physical index name                |
| `OPENSEARCH_ALIAS`             | `products`                                     | Active search alias name                   |
| `REDIS_URL`                    | `redis://localhost:6379`                       | Redis connection URL                       |
| `REDIS_KEY_PREFIX`             | `search:v1:`                                   | Key namespace for every search-service key |
| `SEARCH_CACHE_TTL_SECONDS`     | `300`                                          | Search results cache TTL                   |
| `SUGGESTION_CACHE_TTL_SECONDS` | `600`                                          | Suggestions cache TTL                      |
| `KAFKA_BROKERS`                | `localhost:9094,localhost:9095,localhost:9096` | Kafka broker endpoints                     |
| `KAFKA_GROUP_ID`               | `search-service-group`                         | Kafka consumer group ID                    |
| `CLERK_SECRET_KEY`             | —                                              | Clerk secret key for auth                  |
| `CLERK_PUBLISHABLE_KEY`        | —                                              | Clerk publishable key for service config   |
| `LOG_LEVEL`                    | `info`                                         | Structured log level                       |
| `OTEL_SERVICE_NAME`            | `search-service`                               | OpenTelemetry service name                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | `http://localhost:4318`                        | OpenTelemetry collector endpoint           |
