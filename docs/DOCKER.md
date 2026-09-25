# Larekmart Containerization & Docker DevOps Guide

This document is the comprehensive operations manual for building, running, monitoring, and troubleshooting the entire Larekmart microservices ecosystem in Docker.

---

## 1. Ecosystem Architecture

Larekmart's container topology is organized into an isolated Docker bridge network (`larekmart-network`) with internal service discovery. Microservices communicate with backing infrastructure and event buses via Docker DNS hostnames rather than `localhost`.

```
                    ┌────────────────────────┐
                    │  Storefront (:3002)    │
                    │  Admin Portal (:3003)  │
                    └───────────┬────────────┘
                                │ HTTP / REST / WebSocket
    ┌───────────────────────────┴────────────────────────────┐
    ▼                                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                  13 Microservices Tier                       │
│  product-service (8000)        cart-service (8009)           │
│  order-service (8001)          catalog-service (8010)        │
│  payment-service (8002)        shipping-service (8011)       │
│  auth-service (8003)           notification-service (8005)   │
│  analytic-service (8004)       recommendation-service (8008) │
│  search-service (8006)         email-service (worker)        │
│  inventory-service (8007)                                    │
└──────────────┬──────────────────┬─────────────────┬──────────┘
               │                  │                 │
               ▼                  ▼                 ▼
     ┌──────────────────┐  ┌─────────────┐  ┌──────────────┐
     │  Apache Kafka    │  │ PostgreSQL  │  │   MongoDB    │
     │  (KRaft Broker)  │  │ (pgvector)  │  │ (ReplicaSet) │
     │   :9092 / :9094  │  │    :5432    │  │    :27017    │
     └─────────┬────────┘  └─────────────┘  └──────────────┘
               │                  ▲
               ▼                  │
     ┌──────────────────┐  ┌──────┴──────┐
     │  OpenSearch Node │  │    Redis    │
     │      :9200       │  │    :6379    │
     └──────────────────┘  └─────────────┘
```

---

## 2. Infrastructure Directory Layout

All infrastructure Dockerfiles reside in the dedicated `docker/` directory:

```text
docker/
├── redis/
│   ├── Dockerfile
│   └── redis.conf                  # Persistence (AOF) + maxmemory LRU eviction
├── postgres/
│   ├── Dockerfile                  # pgvector/pgvector:pg16 image
│   └── init-multiple-databases.sh  # Automated provisioning of all service DBs
├── kafka/
│   └── Dockerfile                  # Apache Kafka KRaft single-node broker
├── opensearch/
│   └── Dockerfile                  # OpenSearch cluster node with REST API
└── mongodb/
    ├── Dockerfile                  # Official MongoDB engine
    └── init-db.js                  # Automated database & collection initializer
```

---

## 3. Network & Port Allocations

| Service / Container      | Container Port                    | Host Port    | Protocol / Purpose                   |
| ------------------------ | --------------------------------- | ------------ | ------------------------------------ |
| `postgres`               | `5432`                            | `5432`       | PostgreSQL + pgvector databases      |
| `mongo`                  | `27017`                           | `27017`      | MongoDB Database                     |
| `mongo-express`          | `8081`                            | `8081`       | Mongo-Express Web Admin UI           |
| `redis`                  | `6379`                            | `6379`       | In-memory cache & pub/sub            |
| `kafka`                  | `9092` (internal) / `9094` (host) | `9092, 9094` | Apache Kafka event bus               |
| `opensearch`             | `9200`                            | `9200`       | Product search & autocomplete        |
| `kafka-ui`               | `8080`                            | `8080`       | Web UI for topics & consumers        |
| `product-service`        | `8000`                            | `8000`       | Product catalog CRUD & sync          |
| `order-service`          | `8001`                            | `8001`       | Order lifecycle & MongoDB storage    |
| `payment-service`        | `8002`                            | `8002`       | Stripe payments & webhook processing |
| `auth-service`           | `8003`                            | `8003`       | Clerk user & admin gateway           |
| `analytic-service`       | `8004`                            | `8004`       | Event stream metrics aggregator      |
| `notification-service`   | `8005`                            | `8005`       | Multi-channel alerts & WebSockets    |
| `search-service`         | `8006`                            | `8006`       | OpenSearch query engine              |
| `inventory-service`      | `8007`                            | `8007`       | Stock ledgers & reservations         |
| `recommendation-service` | `8008`                            | `8008`       | Hybrid pgvector recommendations      |
| `cart-service`           | `8009`                            | `8009`       | Authoritative shopping carts         |
| `catalog-service`        | `8010`                            | `8010`       | Read-optimized storefront catalog    |
| `shipping-service`       | `8011`                            | `8011`       | Carrier rate quote & dispatch        |
| `email-service`          | None                              | None         | Background Kafka email worker        |
| `client`                 | `3002`                            | `3002`       | Next.js 15 Storefront UI             |
| `admin`                  | `3003`                            | `3003`       | Next.js 15 Admin Dashboard UI        |

---

## 4. Quick Start Commands

### Prerequisites

- Docker Engine 24.0+ & Docker Compose v2.20+
- At least 8 GB available RAM (recommended 12 GB for full stack)

### 1. Environment Setup

Copy the global `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure your Clerk and Stripe credentials are added if you plan to execute authenticated requests or live payments.

### 2. Start the Entire Ecosystem

Build and start all backing databases, messaging brokers, microservices, and frontends:

```bash
docker compose up --build
```

Or run detached in the background:

```bash
docker compose up -d --build
```

### 3. Start Infrastructure Backing Services Only

If developing individual services locally using `pnpm dev`, start only the databases and message bus:

```bash
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui
```

### 4. Stop the Environment

```bash
# Stop containers (preserves persistent volumes)
docker compose down

# Stop and purge volumes (fresh database slate)
docker compose down -v
```

---

## 5. Development & Maintenance Operations

### Viewing Logs

```bash
# Follow logs of all services
docker compose logs -f

# Follow logs of a specific service
docker compose logs -f product-service
docker compose logs -f kafka
docker compose logs -f order-service
```

### Rebuilding an Individual Microservice

```bash
docker compose up -d --build --no-deps product-service
```

### Checking Service Health & Status

```bash
docker compose ps
```

### Inspecting Kafka Topics via Web UI

Open your browser to:
[http://localhost:8080](http://localhost:8080)

---

## 6. Database Migrations & Initial Setup

When spinning up PostgreSQL for the first time, `docker/postgres/init-multiple-databases.sh` automatically initializes all required databases:

- `product_db`
- `inventory_db` (`larekmart_inventory_db`)
- `catalog_db`
- `shipping_db` (`larekmart_shipping_db`)
- `analytics_db`
- `larekmart_notification_db`
- `recommendation_db` (with `CREATE EXTENSION vector;`)

To run Prisma migrations against the running containerized database:

```bash
pnpm --filter @repo/product-db db:deploy
pnpm --filter @repo/inventory-db db:deploy
pnpm --filter @repo/catalog-db db:deploy
pnpm --filter @repo/shipping-db db:deploy
```

To seed initial catalog data:

```bash
pnpm --filter @repo/product-db db:seed
```

---

## 7. Troubleshooting

### 1. Kafka Connection Timeout / Unknown Broker

- Ensure your service uses `KAFKA_BROKERS=kafka:9092` when running inside the Docker network.
- For host-run processes connecting to the containerized Kafka broker, use `localhost:9094`.

### 2. MongoDB Authentication & Connection

- MongoDB runs with root authentication (`MONGO_INITDB_ROOT_USERNAME=root`, `MONGO_INITDB_ROOT_PASSWORD=example`) defined in `docker-compose.yml` and `.env.example`.
- `docker/mongodb/init-db.js` automatically provisions the necessary databases (`order_db`, `ecommerce`) and collections on initial startup.
- Connection string inside Docker network:
  `mongodb://root:example@mongo:27017/<database>?authSource=admin`
- Host connection (for local development outside Docker):
  `mongodb://root:example@localhost:27017/<database>?authSource=admin`
- Inspect databases via Mongo-Express UI at [http://localhost:8081](http://localhost:8081) (Basic Auth: `mongoexpressuser` / `mongoexpresspass`).

### 3. OpenSearch Memory Limits

- OpenSearch is configured with `-Xms512m -Xmx512m` and `bootstrap.memory_lock=false` for local development. If running on Linux and encountering `vm.max_map_count` errors, run:
  ```bash
  sudo sysctl -w vm.max_map_count=262144
  ```

---

## 8. Observability Stack

The `docker-compose.observability.yml` file provides a complete monitoring and logging solution that attaches to the `larekmart-network` alongside the main stack.

### Start Observability

```bash
pnpm monitoring:up
# or: docker compose -f docker-compose.observability.yml up -d
```

### Dashboard URLs

| Tool         | URL                   | Default Credentials          |
| ------------ | --------------------- | ---------------------------- |
| Grafana      | http://localhost:3001 | admin / grafana_admin_secret |
| Prometheus   | http://localhost:9090 | —                            |
| Alertmanager | http://localhost:9093 | —                            |
| Loki         | http://localhost:3100 | —                            |

### Exporters

| Exporter          | Port | Purpose                              |
| ----------------- | ---- | ------------------------------------ |
| Node Exporter     | 9100 | Host CPU, memory, disk, network      |
| Redis Exporter    | 9121 | Redis memory, connections, evictions |
| Postgres Exporter | 9187 | Connections, query stats             |
| MongoDB Exporter  | 9216 | Connections, replica set health      |

### Alert Rules

Production alert rules are defined in `infrastructure/observability/prometheus/rules/alerts.yml`. Critical alerts include:

- `ServiceDown` — any service unreachable for 1+ minute
- `HighErrorRate` — 5xx rate > 5% for 2+ minutes
- `HighLatencyP99` — P99 latency > 2s for 3+ minutes
- `PodCrashLooping` — 3+ pod restarts in 15 minutes
- `DiskSpaceCritical` — < 5% disk remaining
- `KafkaBrokerDown` — no Kafka brokers available
- `RedisDown` / `MongoDBDown` / `PostgresDown`

---

## 9. Kubernetes Deployment

See `infrastructure/kubernetes/README.md` for the full Kubernetes operations guide.

### Quick Validation

```bash
# Validate manifests (development overlay)
pnpm k8s:validate

# Apply to development cluster (Minikube / Kind / Docker Desktop K8s)
pnpm k8s:dev

# Check status
kubectl get pods,svc,hpa,ingress -n larekmart-dev
```

### Overlay Summary

| Overlay       | Namespace           | Replicas   | Tags          |
| ------------- | ------------------- | ---------- | ------------- |
| `development` | `larekmart-dev`     | 1          | `:dev`        |
| `staging`     | `larekmart-staging` | 2          | `:staging`    |
| `production`  | `larekmart`         | 2–10 (HPA) | Immutable SHA |
