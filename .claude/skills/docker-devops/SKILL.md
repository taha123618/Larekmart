---
name: docker-devops
description: >
  Comprehensive Docker, Docker Compose, Kubernetes, CI/CD, observability,
  and production-operations guide for the Larekmart microservices platform.
  Use when working with containers, deployments, monitoring, or infrastructure.
---

# Docker DevOps & Cloud-Native Operations — Larekmart

## Purpose

This skill provides the authoritative reference for containerisation, orchestration,
observability, CI/CD, secrets management, and disaster recovery in the Larekmart
monorepo. Use it whenever you are:

- Writing or modifying Dockerfiles
- Working with Docker Compose (development or observability stacks)
- Creating or updating Kubernetes manifests or Kustomize overlays
- Adding Prometheus metrics or Grafana dashboards
- Designing or changing CI/CD workflows
- Managing environment variables or secrets
- Performing database migrations in any environment
- Troubleshooting infrastructure issues

---

## 1. Directory Map

```text
infrastructure/
├── kubernetes/
│   ├── base/                   # Namespace, ConfigMaps, Secrets, all Deployments/Services
│   │   ├── configmaps/         # common-config.yaml
│   │   ├── secrets/            # secret-templates.yaml (DO NOT store real secrets here)
│   │   ├── frontends/          # client.yaml, admin.yaml
│   │   ├── services/           # 12 backend service Deployments + ClusterIP Services
│   │   ├── workers/            # email-service.yaml (headless Kafka consumer)
│   │   ├── autoscaling/        # hpa.yaml (HPA for high-traffic services)
│   │   ├── pdb/                # pod-disruption-budgets.yaml
│   │   ├── network-policies/   # Zero-trust isolation rules
│   │   ├── ingress.yaml        # NGINX Ingress with TLS, CORS, WebSocket
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── development/        # 1 replica, local hostnames, :dev tags
│       ├── staging/            # staging hostnames, :staging tags
│       └── production/         # 2+ replicas, immutable SHA tags, full HA
│
└── observability/
    ├── prometheus/             # prometheus.yml + rules/alerts.yml
    ├── alertmanager/           # alertmanager.yml (Slack + PagerDuty)
    ├── grafana/                # provisioning/ + dashboards/*.json
    ├── loki/                   # loki.yml (31-day retention)
    └── promtail/               # promtail.yml (Docker log collection)

docker-compose.yml              # Full dev stack (all services + infra)
docker-compose.observability.yml # Prometheus, Grafana, Alertmanager, Loki, Promtail, exporters
.github/workflows/
├── ci.yml                      # Full CI/CD pipeline
├── migrate.yml                 # Manual-trigger DB migrations
└── security.yml                # Weekly Trivy/Snyk/pnpm audit
```

---

## 2. Docker Conventions

### Multi-Stage Builds

All service Dockerfiles use Turbo Prune multi-stage builds:

1. `base` — Node.js LTS alpine with `pnpm` and `turbo` installed
2. `pruner` — runs `turbo prune --scope=<service> --docker` to isolate workspace
3. `deps` — installs production-only workspace dependencies
4. `runner` — minimal production image with `tsx` + `src/` source (ESM monorepo)

### ⚠️ Non-Root Security

All containers use UID 1000 (nodejs / appuser). Never run as root.

### Container-Internal Service Discovery

Services always use Docker/K8s service names, NEVER `localhost`:

| Infrastructure | Internal Host                               |
| -------------- | ------------------------------------------- |
| PostgreSQL     | `postgres:5432`                             |
| MongoDB        | `mongo:27017` (aliases: `mongo`, `mongodb`) |
| Mongo Express  | `mongo-express:8081`                        |
| Redis          | `redis:6379`                                |
| Kafka          | `kafka:9092`                                |
| OpenSearch     | `opensearch:9200`                           |

### Environment Configuration via `env_file`

In `docker-compose.yml`, all microservices and frontends load their environment configuration directly from their workspace directory via `env_file:`:

```yaml
env_file:
  - ./apps/<service>/.env
```

### KAFKA_BROKERS Override

```ts
// packages/kafka/src/client.ts already reads process.env.KAFKA_BROKERS
// Set this env var to "kafka:9092" inside any Docker service/container
```

---

## 3. Docker Compose Workflows

### Full Development Stack

```bash
# Start all backing infrastructure
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui

# Start all services
docker compose up -d

# Tail logs for a specific service
docker compose logs -f product-service

# Rebuild a single service image
docker compose build --no-cache product-service

# Validate compose syntax
docker compose config --quiet
```

### Observability Stack

```bash
# Start observability (attaches to larekmart-network)
pnpm monitoring:up
# or: docker compose -f docker-compose.observability.yml up -d

# Access dashboards
open http://localhost:3001   # Grafana (admin / grafana_admin_secret)
open http://localhost:9090   # Prometheus
open http://localhost:9093   # Alertmanager
open http://localhost:3100   # Loki

# Validate config
docker compose -f docker-compose.observability.yml config --quiet
```

---

## 4. Kubernetes Operations

### Validate Before Applying

```bash
# Always validate first — never apply without checking
kubectl kustomize infrastructure/kubernetes/overlays/production

# Apply a specific overlay
kubectl apply -k infrastructure/kubernetes/overlays/development

# Check rollout status
kubectl rollout status deployment/product-service -n larekmart --timeout=3m

# Get all resources
kubectl get pods,svc,hpa,ingress -n larekmart
```

### Rolling Deployments

```bash
# Update an image tag (triggers zero-downtime rolling update)
kubectl set image deployment/product-service product-service=ghcr.io/org/larekmart/product-service:v1.2.3 -n larekmart

# Rollback if deployment fails
kubectl rollout undo deployment/product-service -n larekmart
kubectl rollout history deployment/product-service -n larekmart
```

### Scale Services

```bash
kubectl scale deployment/catalog-service --replicas=5 -n larekmart
```

### Watch Pod Events

```bash
kubectl describe pod <pod-name> -n larekmart
kubectl logs -f <pod-name> -n larekmart --previous  # previous container if crashed
```

---

## 5. Autoscaling

Services with HPAs (`client`, `catalog-service`, `search-service`, `cart-service`, `order-service`):

- Scale up at **70% CPU or 80% Memory**
- Min replicas: 2, Max replicas: 6–10
- Scale-down stabilisation window: **5 minutes** (prevents flapping)
- Never modify the HPA `maxReplicas` above 10 without first checking DB connection limits

---

## 6. Prometheus Metrics

Services expose `GET /metrics` via `@repo/monitoring`. The Prometheus config in
`infrastructure/observability/prometheus/prometheus.yml` scrapes all services.

**Key Metrics to Watch:**

- `http_requests_total{status=~"5.."}` — error rate
- `http_request_duration_seconds` — latency histograms
- `up` — service availability
- `kafka_consumergroup_lag_sum` — consumer lag
- `redis_memory_used_bytes / redis_memory_max_bytes` — Redis pressure
- `pg_stat_activity_count` — PostgreSQL connections

**Alert Rules:** see `infrastructure/observability/prometheus/rules/alerts.yml`

---

## 7. Grafana Dashboards

| Dashboard      | UID                        | Purpose                                          |
| -------------- | -------------------------- | ------------------------------------------------ |
| Service Health | `larekmart-service-health` | Error rate, latency, request rate per service    |
| Infrastructure | `larekmart-infra`          | CPU, memory, Redis, Postgres, Kafka consumer lag |

Add new dashboards as JSON files in `infrastructure/observability/grafana/dashboards/`.
They are auto-provisioned on Grafana startup.

---

## 8. CI/CD Pipeline

```text
push to main/develop
    │
    ├── code-quality      (lint, format check, tsc check-types)
    ├── build             (turbo build + Prisma generate)
    ├── go-tests          (notification-service: go test -race)
    ├── python-tests      (recommendation-service: ruff + mypy)
    │
    ├── docker-build      (15 services in parallel — matrix strategy)
    │   ├── Buildx multi-arch (amd64 + arm64)
    │   ├── Push to ghcr.io with SHA tag
    │   └── Trivy vulnerability scan per image
    │
    ├── validate-k8s      (kustomize build all overlays, compose config check)
    │
    ├── deploy-staging    (on push to develop — kubectl apply staging overlay)
    └── deploy-production (on push to main — requires GitHub environment approval)
```

**Manual workflows:**

- `migrate.yml` — manually trigger Prisma DB migrations per environment
- `security.yml` — weekly Trivy/Snyk scan (runs automatically Mon 03:00 UTC)

---

## 9. Secrets Management

### Development

Secrets live in `.env` (gitignored). Reference `.env.example` for all required vars.
Never commit real secrets.

### Kubernetes Production

The `infrastructure/kubernetes/base/secrets/secret-templates.yaml` is a **template only**.
In production, use one of:

- **External Secrets Operator** (ESO) — sync from AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault
- **Sealed Secrets** — encrypt Kubernetes Secrets and commit the sealed form
- **Helm Secrets** / SOPS — for Helm-based deployments

**Required Kubernetes Secrets** (`larekmart-secrets`):

```yaml
POSTGRES_PASSWORD, MONGODB_URI, MONGODB_CART_URI,
CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

---

## 10. Database Migrations

### Development

```bash
pnpm --filter @repo/product-db db:migrate     # development migration
pnpm --filter @repo/inventory-db db:migrate
pnpm --filter @repo/catalog-db db:migrate
pnpm --filter @repo/shipping-db db:migrate
```

### Production

Use the manual `migrate.yml` GitHub Actions workflow with environment protection.
Never run `db:migrate` directly in production — always use `db:deploy` (deterministic).

**Rule:** Generate the Prisma client after every schema change:

```bash
pnpm --filter @repo/product-db db:generate
```

---

## 11. Network Policies (Zero-Trust)

In Kubernetes:

- **Default deny all** is applied globally
- Only Ingress NGINX can reach frontend/backend pods
- Only the `monitoring` namespace (Prometheus) can scrape `/metrics`
- No direct pod-to-pod HTTP — **services communicate exclusively via Kafka**

---

## 12. Backup & Disaster Recovery

### PostgreSQL

```bash
# Dump all DBs
docker exec larekmart-postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d).sql
# Restore
docker exec -i larekmart-postgres psql -U postgres < backup_20240101.sql
```

### MongoDB

```bash
# Dump (requires admin authentication)
docker exec larekmart-mongo mongodump --uri="mongodb://root:example@localhost:27017/?authSource=admin" --out=/data/backup
# Restore
docker exec larekmart-mongo mongorestore --uri="mongodb://root:example@localhost:27017/?authSource=admin" /data/backup
```

### Redis

- Redis is configured with AOF persistence (every second) in `docker/redis/redis.conf`
- RDB snapshots also enabled

**RPO target:** < 1 hour | **RTO target:** < 30 minutes

---

## 13. Troubleshooting

### Container not starting

```bash
docker compose logs <service>                        # Check logs
docker inspect larekmart-<service>                   # Check config
docker compose ps                                    # Check status
```

### Service can't reach Kafka

- Verify `KAFKA_BROKERS=kafka:9092` is set in the service's environment
- Confirm Kafka container is healthy: `docker compose ps kafka`

### MongoDB Authentication / Initialization

- Container builds from `docker/mongodb/Dockerfile` with `docker/mongodb/init-db.js` running on first start
- Web Admin UI: Mongo Express is running on `http://localhost:8081` (`mongoexpressuser` / `mongoexpresspass`)
- Check ping: `docker exec larekmart-mongo mongosh -u root -p example --authenticationDatabase admin --eval "db.adminCommand('ping')"`

### Postgres connection refused

- Check `DATABASE_URL` uses `postgres` as host (not `localhost`)
- Verify pgvector extension: `docker exec larekmart-postgres psql -U postgres -c "\\dx"`

### OpenSearch not indexing

- Check memory lock: `vm.max_map_count=262144` required on Linux hosts
- Mac Docker Desktop: ulimits handled by VM, usually fine

### High Kafka consumer lag

- Increase replicas for affected consumer services (email, analytic, notification)
- Check for poison-pill messages: inspect DLQ or add error handling in consumer loop
