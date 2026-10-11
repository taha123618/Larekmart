---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---

# External Integrations

**Analysis Date:** 2026-10-02

## APIs & External Services

**Payment Processing:**

- Stripe - Payment processing, checkout sessions, invoice webhooks, product catalog sync
  - SDK/Client: `stripe` (^17.7.0 in `apps/payment-service/package.json`)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Identity & Access Management:**

- Clerk - User authentication, session tokens, JWT claims, organization memberships, admin RBAC
  - SDK/Client: `@clerk/nextjs` (in `apps/client`, `apps/admin`) and `@clerk/clerk-sdk-node` (in backend services)
  - Auth: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`

**Logistics & Carrier Adapters:**

- TCS Logistics, Leopards Courier, DHL Express, FedEx
  - Implementation: Carrier strategy adapters in `apps/shipping-service/src/carriers/`
  - Auth: `TCS_API_KEY`, `LEOPARDS_API_KEY`, `DHL_API_KEY`, `FEDEX_CLIENT_SECRET`

**Email Delivery:**

- SendGrid / Resend SMTP
  - Consumer: `apps/email-service` consumes Kafka `order.created`, `payment.succeeded` events
  - Auth: `EMAIL_SERVICE_API_KEY`, `SMTP_HOST`, `SMTP_PORT`

## Data Storage

**Databases:**

- PostgreSQL 16 (Relational DB with `pgvector` extension)
  - Connection: `POSTGRES_URL` / `DATABASE_URL`
  - Client: Prisma ORM (`@prisma/client`) across `packages/*-db` and Drizzle ORM in `apps/media-service`
  - Stores: `product_db`, `inventory_db`, `catalog_db`, `shipping_db`, `user_db`, `media_db`
- MongoDB 7.0 (ReplicaSet document store)
  - Connection: `MONGODB_URI` / `MONGODB_CART_URI`
  - Client: Mongoose ODM (`packages/order-db`, `packages/cart-db`)
  - Stores: `order_db`, `cart_db`
- OpenSearch 2.17 (Distributed full-text & vector search engine)
  - Connection: `OPENSEARCH_NODE`
  - Client: `@opensearch-project/opensearch` (`packages/opensearch`)
  - Indexes: `larekmart-products-v1`

**File Storage:**

- MinIO / AWS S3 (S3-compatible Object Storage)
  - Connection: `S3_ENDPOINT`, `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Usage: Uploaded media assets, image variants, product thumbnails (`apps/media-service`)

**Caching & Transient State:**

- Redis 7.4 (In-memory key-value store with AOF persistence)
  - Connection: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - Client: `ioredis` (`packages/redis`)
  - Usage: Session locks, cart cache, read-model caching (catalog), rate limiting

## Authentication & Identity

**Auth Provider:**

- Clerk (Hosted Identity Provider)
  - Implementation: Route middleware `shouldBeUser` and `shouldBeAdmin` verifying Bearer tokens and session claims (`sessionClaims.metadata.role === "admin"`). No passwords stored in internal databases.

## Monitoring & Observability

**Error Tracking & Telemetry:**

- Prometheus (v2.53.0) scraping application `/metrics` endpoints via `@repo/monitoring`
- Alertmanager (v0.27.0) with Webhook/Slack alert routing
- Grafana (v11.2.0) with provisioned application and infrastructure dashboards

**Logs:**

- Structured JSON logging (`x-correlation-id` injected across HTTP and Kafka boundaries)
- Log Shipper: Promtail (v3.1.0) streaming container logs to Grafana Loki (v3.1.0)

## CI/CD & Deployment

**Hosting:**

- Containerized Kubernetes Cluster (orchestrated via Kustomize in `infrastructure/kubernetes/`)
- Multi-environment overlays: `development`, `staging`, `production`

**CI Pipeline:**

- GitHub Actions: `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `.github/workflows/migrate.yml`
- Security Gates: `pnpm audit`, Snyk code scan, Trivy fs scan, Docker Scout Quickview image verification

## Environment Configuration

**Required env vars:**

- `PORT` - Service listener port
- `KAFKA_BROKERS` - Comma-separated list of Kafka broker endpoints
- `POSTGRES_URL` - PostgreSQL connection string
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` - Redis hostname
- `CLERK_SECRET_KEY` - Clerk backend authentication key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

**Secrets location:**

- Staged in `.env` files locally (uncommitted, gitignored)
- Synchronized in Kubernetes via External Secrets Operator (`base/secrets/external-secrets.yaml`) from AWS Secrets Manager / HashiCorp Vault

## Webhooks & Callbacks

**Incoming:**

- `POST /api/v1/payments/webhook` (`apps/payment-service`) - Handled from Stripe webhook dispatcher with signature verification (`stripe.webhooks.constructEvent`)
- Carrier tracking updates (`POST /api/v1/shipping/webhooks/*`)

**Outgoing:**

- Kafka Event Bus (`@repo/kafka`) - Emits topics `order.created`, `order.status_updated`, `payment.succeeded`, `inventory.reserved`, `product.created`
- Carrier label creation & tracking request dispatchers (`apps/shipping-service`)

---

_Integration audit: 2026-10-02_
