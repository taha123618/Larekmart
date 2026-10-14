# Larekmart Containerization & Docker DevOps Guide

This document is the comprehensive operations manual for building, running, monitoring, and troubleshooting the entire Larekmart microservices ecosystem in Docker.

---

## Table of Contents

1. [Ecosystem Architecture](#1-ecosystem-architecture)
2. [Infrastructure Directory Layout](#2-infrastructure-directory-layout)
3. [Network & Port Allocations](#3-network--port-allocations)
4. [Edge Ingress & Reverse-Proxy Architecture](#4-edge-ingress--reverse-proxy-architecture)
5. [Quick Start Commands](#5-quick-start-commands)
6. [Horizontal Autoscaling & WebSocket Scaling](#6-horizontal-autoscaling--websocket-scaling)
7. [Development & Maintenance Operations](#7-development--maintenance-operations)
8. [Database Migrations & Initial Setup](#8-database-migrations--initial-setup)
9. [Troubleshooting](#9-troubleshooting)
10. [Observability Stack](#10-observability-stack)
11. [Kubernetes Deployment](#11-kubernetes-deployment)
12. [Container Security, Hardening & Docker Scout Workflow](#12-container-security-hardening--docker-scout-workflow)
    - [12.1 Image Hardening Philosophy & Standards](#121-image-hardening-philosophy--standards)
    - [12.2 Complete Project Image Inventory & Hardening Matrix](#122-complete-project-image-inventory--hardening-matrix)
    - [12.3 Docker Scout Verification Workflow](#123-docker-scout-verification-workflow)
    - [12.4 Production Readiness Gate & Vulnerability SLA](#124-production-readiness-gate--vulnerability-sla)
    - [12.5 Repeatable Automated Verification & CI/CD](#125-repeatable-automated-verification--cicd)
    - [12.6 Known Vulnerabilities, Exceptions & Mitigation Register (VEX)](#126-known-vulnerabilities-exceptions--mitigation-register-vex)
    - [12.7 Developer Runbook: Introducing or Updating an Image](#127-developer-runbook-introducing-or-updating-an-image)

---

## 1. Ecosystem Architecture

Larekmart's production container topology is organized into an isolated Docker bridge network (`larekmart-network`) with dynamic service discovery and edge traffic segregation. All external internet traffic enters through **Traefik v3** on ports `80` and `443`, terminating TLS and routing to public application tiers. Backend microservices communicate with backing infrastructure and event buses via Docker DNS hostnames rather than public IPs.

```
                              Internet / External Traffic
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │         Traefik v3 Edge Ingress              │
                    │       Ports: 80 (HTTP) / 443 (HTTPS)         │
                    │       ACME TLS (Let's Encrypt HTTP-01)       │
                    │     Rate-Limiting, Gzip, Security Headers    │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼ Host: shop.localhost            ▼ Host: admin.localhost          ▼ Host: api.localhost
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│     Client Storefront     │     │     Admin Dashboard       │     │        API Gateway        │
│   Next.js 15 (Port 3002)  │     │   Next.js 15 (Port 3003)  │     │     Fastify 5 (Port 8090) │
└───────────────────────────┘     └───────────────────────────┘     └─────────────┬─────────────┘
                                                                                  │
                                              ┌───────────────────────────────────┤
                                              │ (/ws WebSocket proxy)             │ (/api/* REST routes)
                                              ▼                                   ▼
                                 ┌──────────────────────────┐        ┌──────────────────────────┐
                                 │   Notification Service   │        │ 13 Domain Microservices  │
                                 │   Go Chi WS Hub (:8005)  │        │ (Product, Order, Cart,   │
                                 └──────────────────────────┘        │  Catalog, Inventory,     │
                                                                     │  Payment, Search, etc.)  │
                                                                     └─────────────┬────────────┘
                                                                                   │
                                                                    ┌──────────────┴────────────┐
                                                                    │ Shared Backing Platform   │
                                                                    │ (Kafka, Postgres, Mongo,  │
                                                                    │  Redis, OpenSearch, S3)   │
                                                                    └───────────────────────────┘
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
├── nginx/
│   ├── Dockerfile                  # Dozzle logs reverse proxy (100M upload & SSE)
│   └── nginx.conf                  # Nginx configuration for Dozzle log viewer
└── mongodb/
    ├── Dockerfile                  # Official MongoDB engine
    └── init-db.js                  # Automated database & collection initializer
```

---

## 3. Network & Port Allocations

> **Security Hardening Standard:** Only Traefik publishes ports to `0.0.0.0` (public network). All internal microservices, datastores, and development admin tools bind to `127.0.0.1` (loopback) via environment variables (`INTERNAL_SERVICE_BIND_IP`, `DB_BIND_IP`, `API_GATEWAY_BIND_IP`) to prevent perimeter scanning.

| Service / Container      | Container Port                    | Host Port (Dev / Local)              | Production Exposure | Protocol / Purpose                                                      |
| ------------------------ | --------------------------------- | ------------------------------------ | ------------------- | ----------------------------------------------------------------------- |
| **`traefik`**            | `80`, `443`, `8088`               | `80:80`, `443:443`, `127.0.0.1:8088` | **Public**          | Edge router, automated Let's Encrypt TLS, dynamic container discovery   |
| **`client`**             | `3002`                            | `127.0.0.1:3002`                     | Traefik Ingress     | Next.js 15 Storefront UI (`shop.localhost`)                             |
| **`admin`**              | `3003`                            | `127.0.0.1:3003`                     | Traefik Ingress     | Next.js 15 Admin Dashboard UI (`admin.localhost`)                       |
| **`dozzle`** (Nginx)     | `80` (proxy) / `8888` (dozzle)    | `127.0.0.1:8085`                     | Traefik Ingress     | Real-time container log streaming (`logs.localhost` / `:8085`)          |
| **`rootprint`**          | `8282`                            | `127.0.0.1:8282`                     | Traefik Ingress     | Distributed log analytics & search UI (`rootprint.localhost` / `:8282`) |
| **`minio`** (Rootprint)  | `9000` (API), `9001` (Console)    | `127.0.0.1:9000`, `127.0.0.1:9001`   | **Internal Only**   | S3-compatible index storage & web console for Quickwit/Rootprint        |
| **`quickwit`**           | `7280`                            | `127.0.0.1:7280`                     | **Internal Only**   | Fast distributed search & indexing engine for Rootprint logs            |
| **`caddy`** (profile)    | `80`, `443`                       | `127.0.0.1:8086`, `127.0.0.1:8443`   | Optional Ingress    | Standalone HTTP/2 & HTTP/3 reverse proxy (run via `--profile caddy`)    |
| **`kafka-ui`**           | `8080`                            | `127.0.0.1:8080`                     | Traefik Ingress     | Topic & consumer monitoring UI (`kafka.localhost`)                      |
| `postgres`               | `5432`                            | `127.0.0.1:5432`                     | **Internal Only**   | PostgreSQL + pgvector databases                                         |
| `mongo`                  | `27017`                           | `127.0.0.1:27017`                    | **Internal Only**   | MongoDB Database                                                        |
| `mongo-express`          | `8081`                            | `127.0.0.1:8081`                     | **Internal Only**   | Mongo-Express Web Admin UI                                              |
| `redis`                  | `6379`                            | `127.0.0.1:6379`                     | **Internal Only**   | In-memory cache & pub/sub                                               |
| `kafka`                  | `9092` (internal) / `9094` (host) | `127.0.0.1:9092, 127.0.0.1:9094`     | **Internal Only**   | Apache Kafka KRaft event broker                                         |
| `opensearch`             | `9200`, `9600`                    | `127.0.0.1:9200, 127.0.0.1:9600`     | **Internal Only**   | Product search & autocomplete engine                                    |
| `product-service`        | `8000`                            | `127.0.0.1:8000`                     | **Internal Only**   | Product catalog CRUD & sync                                             |
| `order-service`          | `8001`                            | `127.0.0.1:8001`                     | **Internal Only**   | Order lifecycle & MongoDB storage                                       |
| `payment-service`        | `8002`                            | `127.0.0.1:8002`                     | **Internal Only**   | Stripe payments & webhook processing                                    |
| `auth-service`           | `8003`                            | `127.0.0.1:8003`                     | **Internal Only**   | Clerk user & admin gateway                                              |
| `analytic-service`       | `8004`                            | `127.0.0.1:8004`                     | **Internal Only**   | Event stream metrics aggregator                                         |
| `notification-service`   | `8005`                            | `127.0.0.1:8005`                     | **Internal Only**   | Multi-channel alerts & Go Chi WebSocket hub                             |
| `search-service`         | `8006`                            | `127.0.0.1:8006`                     | **Internal Only**   | OpenSearch query engine                                                 |
| `inventory-service`      | `8007`                            | `127.0.0.1:8007`                     | **Internal Only**   | Stock ledgers & reservations                                            |
| `recommendation-service` | `8008`                            | `127.0.0.1:8008`                     | **Internal Only**   | Hybrid pgvector recommendations                                         |
| `cart-service`           | `8009`                            | `127.0.0.1:8009`                     | **Internal Only**   | Authoritative shopping carts                                            |
| `catalog-service`        | `8010`                            | `127.0.0.1:8010`                     | **Internal Only**   | Read-optimized storefront catalog                                       |
| `shipping-service`       | `8011`                            | `127.0.0.1:8011`                     | **Internal Only**   | Carrier rate quote & dispatch                                           |
| `user-service`           | `8012`                            | `127.0.0.1:8012`                     | **Internal Only**   | Customer profiles, addresses & preferences                              |
| `media-service`          | `8013`                            | `127.0.0.1:8013`                     | **Internal Only**   | Media uploads, variants & lifecycle                                     |
| `review-service`         | `8014`                            | `127.0.0.1:8014`                     | **Internal Only**   | Product reviews, ratings, verified purchases & moderation               |
| `wishlist-service`       | `8015`                            | `127.0.0.1:8015`                     | **Internal Only**   | Wishlists, saved items, guest merging, price-drop & restock alerts      |
| `media-worker`           | None                              | None                                 | **Internal Only**   | Sharp image-processing job claimer                                      |
| `media-cleanup`          | None                              | None                                 | **Internal Only**   | Session expiry, stale-job requeue, purge GC                             |
| `email-service`          | None (worker)                     | None                                 | **Internal Only**   | Consumes Kafka events, sends email notifications                        |

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
[http://localhost:8090](http://localhost:8090)

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

### 8.4 Logging Architecture & Operational Verdict

The repository provides three distinct logging and observability tools tailored for specific operational environments:

| Tool                            | Compose File                       | Primary Role                           | Memory Footprint                            | Recommended Environment             |
| :------------------------------ | :--------------------------------- | :------------------------------------- | :------------------------------------------ | :---------------------------------- |
| **Dozzle**                      | `docker-compose.dozzle.yml`        | **Live Ephemeral Stream Tailer**       | ~20 MB (zero DB)                            | **Local Development (Inner Loop)**  |
| **Rootprint**                   | `docker-compose.rootprint.yml`     | **Distributed Log Search & Indexing**  | Medium (MinIO + Quickwit + Postgres)        | **Staging & Cloud Post-Mortems**    |
| **Prometheus / Grafana / Loki** | `docker-compose.observability.yml` | **Full Telemetry, Metrics & Alerting** | Medium (Prometheus TSDB + Loki + Exporters) | **Production SRE & SLA Monitoring** |

#### The Verdict:

1. **Inner Dev Loop (Local Development):** Use **Dozzle** (`http://localhost:8085` / `http://logs.localhost`). It streams `docker.sock` live without loading heavy search databases onto your laptop while running 15 services.
2. **Post-Mortem & Kafka Event Tracing:** Use **Rootprint** (`http://localhost:8282` / `http://rootprint.localhost`). Indexes logs into MinIO via Quickwit for sub-second correlation across services by `traceId` or `correlationId`. Survives container restarts.
3. **Production Reliability & Metrics:** Use **Grafana / Prometheus** (`http://localhost:3001` / `http://monitoring.localhost`) for alerting thresholds, p95/p99 latency tracking, and SLI/SLO dashboards.

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

---

## 10. Container Security, Hardening & Docker Scout Workflow

To ensure production safety and supply-chain integrity, **all Docker images utilized across Larekmart must adhere to a strict security and hardening workflow**. Base images must be minimized, stripped of unnecessary tooling, scanned with **Docker Scout Quickview**, and hardened before deployment.

### 10.1 Image Hardening Philosophy & Standards

Our container security model is built upon five foundational principles:

1. **Mandatory Docker Hardened Images (DHI) Baseline:**
   Wherever an appropriate hardened image is available (e.g., via `dhi/*` or Docker Scout recommended hardened baselines), services must use it instead of generic or full-weight base images. DHI reduces image attack surfaces by up to 95%, delivers near-zero known CVEs, includes signed Software Bills of Materials (SBOMs), and carries SLSA Build Level 3 provenance.
2. **Minimal & Multi-Stage Runtime Images:**
   Build tools, compilers (`gcc`, `g++`, `git`), package managers (`apk`, `apt`), and development shells must never be present in the final runtime stage. All service Dockerfiles leverage multi-stage builds (Turbo Prune for Node workspaces, static binary extraction for Go).
3. **Strict Non-Root Execution:**
   No application container is ever permitted to run as `root` (UID 0). Every container runs under an explicitly defined unprivileged user:
   - Node.js Services & Express: `expressjs` / `nodejs` (UID 1001)
   - Next.js Frontends: `nextjs` / `nodejs` (UID 1001)
   - Go Services: `appuser` / `appgroup` (UID 10001)
   - Python Services: `appuser` / `pygroup` (UID 1001)
   - Infrastructure: `postgres` (UID 999), `redis` (UID 999), `kafka` (UID 1000), `opensearch` (UID 1000)
4. **Read-Only Root Filesystems & Linux Capability Drops:**
   In production Kubernetes and staging environments, containers must drop all Linux capabilities (`cap_drop: [ALL]`) and mount the root filesystem as read-only (`read_only: true`), utilizing isolated, non-executable tmpfs volumes for transient scratch needs (`/tmp`).
5. **Deterministic & Immutable Image Tags:**
   Never use mutable `:latest` tags in staging or production. All base images and third-party containers must pin specific, patch-level versions (e.g., `redis:7.4-alpine`, `mongo:7.0-jammy`, `apache/kafka:3.8.0`, `opensearchproject/opensearch:2.17.1`) or immutable digest SHA256 hashes.

---

### 10.2 Complete Project Image Inventory & Hardening Matrix

Every single container image used in the Larekmart platform is cataloged below, along with its current base, hardened target, non-root identity, and verification status:

| Service / Container        | Category               | Current Base Image                 | Hardened DHI Alternative | Runtime User / UID  | Production Gate Target | Hardening Status         |
| :------------------------- | :--------------------- | :--------------------------------- | :----------------------- | :------------------ | :--------------------- | :----------------------- |
| **product-service**        | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **order-service**          | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **payment-service**        | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **auth-service**           | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **analytic-service**       | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **search-service**         | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **inventory-service**      | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **cart-service**           | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **catalog-service**        | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **shipping-service**       | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **media-service**          | Node Microservice      | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **email-service**          | Node Worker            | `node:20-alpine`                   | `dhi/node:20`            | `expressjs` (1001)  | 0 Critical / 0 High    | Hardened (Multi-stage)   |
| **client**                 | Frontend (Next.js 15)  | `node:20-alpine`                   | `dhi/node:20`            | `nextjs` (1001)     | 0 Critical / 0 High    | Hardened (Standalone)    |
| **admin**                  | Frontend (Next.js 15)  | `node:20-alpine`                   | `dhi/node:20`            | `nextjs` (1001)     | 0 Critical / 0 High    | Hardened (Standalone)    |
| **notification-service**   | Go Microservice        | `alpine:3.20`                      | `dhi/alpine:3.20`        | `appuser` (10001)   | 0 Critical / 0 High    | Hardened (Static binary) |
| **recommendation-service** | Python Microservice    | `uv:python3.12-bookworm-slim`      | `dhi/python:3.12`        | `appuser` (1001)    | 0 Critical / 0 High    | Hardened (Rootless uv)   |
| **postgres**               | Backing Database       | `pgvector/pgvector:pg16`           | `dhi/postgres:16`        | `postgres` (999)    | 0 Critical / 0 High    | Pinned & Scanned         |
| **mongo**                  | Backing Database       | `mongo:7.0-jammy`                  | `dhi/mongodb:7.0`        | `mongodb` (999)     | 0 Critical / 0 High    | Pinned & Scanned         |
| **redis**                  | In-Memory Cache        | `redis:7.4-alpine`                 | `dhi/redis:7.4`          | `redis` (999)       | 0 Critical / 0 High    | Pinned & Hardened conf   |
| **kafka**                  | Event Broker           | `apache/kafka:3.8.0`               | `dhi/kafka:3.8`          | `appuser` (1000)    | 0 Critical / 0 High    | Pinned & Scanned         |
| **opensearch**             | Search Engine          | `opensearch:2.17.1`                | `dhi/opensearch:2.17`    | `opensearch` (1000) | 0 Critical / 0 High    | Pinned & Scanned         |
| **kafka-ui**               | Management Web UI      | `provectuslabs/kafka-ui:v0.7.2`    | N/A (Internal)           | `appuser` (1000)    | 0 Critical / 0 High    | Pinned (Dev-only)        |
| **mongo-express**          | Database Web UI        | `mongo-express:1.0.2`              | N/A (Internal)           | `node` (1000)       | 0 Critical / 0 High    | Pinned (Dev-only)        |
| **prometheus**             | Observability          | `prom/prometheus:v2.53.0`          | Distroless Hardened      | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Distroless      |
| **alertmanager**           | Observability          | `prom/alertmanager:v0.27.0`        | Distroless Hardened      | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Distroless      |
| **grafana**                | Observability          | `grafana/grafana:11.2.0`           | Hardened Alpine          | `grafana` (472)     | 0 Critical / 0 High    | Pinned & Scanned         |
| **loki**                   | Observability          | `grafana/loki:3.1.0`               | Hardened Alpine          | `loki` (10001)      | 0 Critical / 0 High    | Pinned & Scanned         |
| **promtail**               | Observability          | `grafana/promtail:3.1.0`           | Hardened Alpine          | `promtail` (10001)  | 0 Critical / 0 High    | Pinned & Scanned         |
| **node-exporter**          | Observability Exporter | `prom/node-exporter:v1.8.2`        | Distroless Hardened      | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Distroless      |
| **redis-exporter**         | Observability Exporter | `oliver006/redis_exporter:v1.62.0` | Scratch Minimal          | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Scratch         |
| **postgres-exporter**      | Observability Exporter | `postgres-exporter:v0.15.0`        | Scratch Minimal          | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Scratch         |
| **mongodb-exporter**       | Observability Exporter | `mongodb_exporter:0.41.2`          | Scratch Minimal          | `nobody` (65534)    | 0 Critical / 0 High    | Pinned & Scratch         |

---

### 10.3 Docker Scout Verification Workflow

Docker Scout provides continuous vulnerability detection, Software Bill of Materials (SBOM) indexing, and automated remediation suggestions.

#### 1. Running Docker Scout Quickview

`quickview` displays a high-level summary of vulnerabilities across the target image and its base layers:

```bash
# Analyze a local built image:
docker scout quickview product-service:latest

# Analyze directly from remote registry (without running Docker daemon):
docker scout quickview registry://redis:7.4-alpine
docker scout quickview registry://node:20-alpine
docker scout quickview registry://alpine:3.20
```

**Understanding the Output Columns:**

```text
 Target     │  registry://node:20-alpine  │    0C     0H     3M     1L
   digest   │  d63c387675b0               │
 Base image │  oisupport/staging-arm64v8  │
```

- **`0C` (Critical):** High-impact vulnerabilities that allow remote code execution or full compromise. Must be **0** for production deployment.
- **`0H` (High):** Significant security vulnerabilities that allow privilege escalation or authentication bypass. Must be **0** (or have an approved VEX exception).
- **`3M` (Medium):** Moderate risks, typically denial-of-service or information disclosures under specific constraints. Must be reviewed and mitigated.
- **`1L` (Low):** Minor issues with low exploitability or informational notes.
- **`Base image delta`:** Shows how many vulnerabilities originate from upstream base image layers versus application layers.

#### 2. Deep CVE Inspection

If vulnerabilities are detected during Quickview, inspect the affected packages:

```bash
# Display full package and CVE breakdown:
docker scout cves <image-name>

# Filter exclusively to Critical and High severities:
docker scout cves --only-severities critical,high <image-name>
```

#### 3. Obtaining Remediation Guidance

Scout provides direct recommendations for upgrading base images to eliminate vulnerabilities:

```bash
docker scout recommendations <image-name>
```

#### 4. Evaluating Hardened Image Transitions with `compare`

When evaluating a Docker Hardened Image (DHI) or an updated base, compare the security delta side-by-side:

```bash
# Compare candidate image against current baseline:
docker scout compare --to dhi/node:20 node:20-alpine
```

#### 5. Generating SBOM and SLSA Provenance Attestations

When building production images, always enable full provenance and SBOM attestations to ensure complete visibility in Docker Scout:

```bash
docker buildx build \
  --provenance=mode=max \
  --sbom=true \
  --tag larekmart/product-service:v1.2.0 \
  --file apps/product-service/Dockerfile .
```

---

### 10.4 Production Readiness Gate & Vulnerability SLA

No image may be released to staging or production environments unless it satisfies the following gate policy:

| Severity     | Allowed Count in Production | Remediation SLA            | Mandatory Action                                                                                                              |
| :----------- | :-------------------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **CRITICAL** | **0**                       | **Immediate (< 24 hours)** | **Deployment Blocked.** Must upgrade to DHI or apply upstream base image patch immediately.                                   |
| **HIGH**     | **0**                       | **< 7 days**               | **Deployment Blocked.** Must remediate or submit formal VEX statement proving non-exploitability in Larekmart's architecture. |
| **MEDIUM**   | Allowed if documented       | **< 30 days**              | Review attack surface. Ensure container runs non-root and lacks external access to affected components.                       |
| **LOW**      | Monitored                   | Next minor release cycle   | Evaluated during routine dependency upgrades.                                                                                 |

---

### 10.5 Repeatable Automated Verification & CI/CD

To make vulnerability audits effortless and repeatable for developers and CI/CD pipelines, Larekmart provides an automated audit script:

#### Local One-Command Verification

```bash
# Run complete Docker Scout audit across all project images:
pnpm docker:scout

# Or run directly via shell:
bash scripts/docker-scout-audit.sh
```

#### GitHub Actions CI/CD Integration

Automated Docker Scout scanning is embedded directly in `.github/workflows/security.yml` and triggers on every weekly schedule as well as pull requests touching Dockerfiles:

```yaml
docker-scout-scan:
  name: Docker Scout Image Security & Hardening Audit
  runs-on: ubuntu-latest
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}
      continue-on-error: true

    - name: Execute Automated Docker Scout Scan
      run: bash scripts/docker-scout-audit.sh
```

---

### 10.6 Known Vulnerabilities, Exceptions & Mitigation Register (VEX)

Where an upstream vulnerability cannot currently be remediated due to lack of a released patch or strict binary compatibility constraints, it must be formally documented in this register with compensating controls and a review date:

| Target Image                     | Package & CVE                       | Severity | Reason for Non-Remediation                                     | Active Compensating Controls (Mitigation)                                                                                                                                           | Review Cadence                       |
| :------------------------------- | :---------------------------------- | :------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| `alpine:3.20` / `node:20-alpine` | `busybox` (CVE-2025-60876)          | MEDIUM   | Upstream patch not yet released in Alpine 3.20 APK repository. | Container runs under unprivileged UID (`appuser` / `expressjs`). Linux capabilities are stripped (`CAP_DROP=ALL`). The busybox shell is never exposed to untrusted external inputs. | Weekly scan via `pnpm docker:scout`  |
| `apache/kafka:3.8.0`             | `bundled-jre` (CVE-2024-20918)      | MEDIUM   | Bundled OpenJDK runtime in Apache official image.              | Kafka is strictly internal on `larekmart-network` and is never exposed directly to public ingress traffic. Accessible only by verified internal microservices.                      | Quarterly Kafka version bump         |
| `opensearch:2.17.1`              | `lucene` / `netty` (CVE-2024-29025) | MEDIUM   | Inherent to current OpenSearch 2.17 search engine release.     | OpenSearch is gated behind `search-service` and isolated from external internet ingress. Bound to internal network with non-root UID 1000.                                          | Track OpenSearch 2.18+ patch release |
| `pgvector:pg16`                  | `libpq` / `openssl` (Debian base)   | LOW/MED  | Upstream Debian base distribution packaging lag.               | Database runs rootless (UID 999), requires password authentication, accessible only over internal network `larekmart-network`.                                                      | Monitored monthly                    |

---

### 10.7 Developer Runbook: Introducing or Updating an Image

When adding a new microservice, worker, or updating an existing base image, follow this strict checklist before submitting a pull request:

1. **Check for an available DHI baseline:**
   Query Docker Hub or DHI catalog for a hardened image (e.g., `dhi/node`, `dhi/golang`, `dhi/python`). If unavailable, select the most minimal, official Alpine or Distroless base image.
2. **Configure Multi-Stage Builds & Non-Root User:**
   Ensure the Dockerfile contains separate builder and runtime stages. Explicitly create an unprivileged user and declare `USER <user>`.
3. **Execute Docker Scout Quickview:**
   ```bash
   docker scout quickview <new-image-name>
   ```
4. **Inspect & Remediate CVEs:**
   Run `docker scout cves --only-severities critical,high <new-image-name>`. If Critical or High vulnerabilities are reported, run `docker scout recommendations` and apply the necessary patches.
5. **Verify Zero Regressions:**
   Execute `pnpm test` and `pnpm check-types` to ensure the hardened image does not introduce runtime breakage.
6. **Update Documentation & Inventory Matrix:**
   Add the new image to Section 10.2 of `docs/DOCKER.md` and to `scripts/docker-scout-audit.sh`. If any un-remediable Medium/Low vulnerability is identified, record it in Section 10.6.
