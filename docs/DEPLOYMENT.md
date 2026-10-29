# Larekmart Production & Staging Deployment Runbook

This runbook outlines standard operating procedures (SOP) for deploying, managing, validating, and rolling back the **Larekmart** microservices platform across Staging and Production environments.

---

## 1. Hosting Architecture & Prerequisites

### 1.1 Compute & Orchestration

- **Kubernetes**: 1.28+ (managed EKS, GKE, AKS, or bare-metal K3s/Rancher).
  - Staging Namespace: `larekmart-staging`
  - Production Namespace: `larekmart`
- **Ingress Controller**: Ingress-NGINX or Traefik with TLS termination via Cert-Manager (`letsencrypt-prod`).
- **Container Registry**: GitHub Container Registry (`ghcr.io/taha123618/larekmart/*`).
  - Pull secret `ghcr-pull-secret` must exist in both target namespaces.

### 1.2 Backing Infrastructure Services

Before deploying application workloads, ensure stateful backing services are provisioned and accessible:

- **PostgreSQL**: 16+ (multi-database setup for `product_db`, `inventory_db`, `catalog_db`, `shipping_db`, `user_db`, `media_db`).
- **MongoDB**: 7.0+ ReplicaSet (`order_db`, `cart_db`).
- **Apache Kafka / Redpanda**: 3.7+ (with standard topics configured: `order-events`, `inventory-events`, `payment-events`, `product-events`, etc.).
- **Redis**: 7.2+ Cluster or Sentinel for caching, rate limiting, and session state.
- **OpenSearch**: 2.11+ for product search, autocomplete, and catalog indexing.
- **MinIO / AWS S3**: Object storage for media uploads and image variants.

---

## 2. Environment Variables & Secret Configuration

### 2.1 GitHub Environment Secrets Matrix

Configure the following secrets in GitHub Repository Settings (`Settings -> Environments`):

| Secret Name                         | Scope      | Description                                                  |
| :---------------------------------- | :--------- | :----------------------------------------------------------- |
| `KUBECONFIG_STAGING`                | Staging    | Base64-encoded Kubeconfig credentials for staging cluster    |
| `KUBECONFIG_PRODUCTION`             | Production | Base64-encoded Kubeconfig credentials for production cluster |
| `STAGING_INGRESS_URL`               | Staging    | Base ingress URL (e.g. `https://staging.larekmart.com`)      |
| `PROD_STORE_URL`                    | Production | Storefront URL (e.g. `https://larekmart.com`)                |
| `PROD_API_URL`                      | Production | API Gateway URL (e.g. `https://api.larekmart.com`)           |
| `STAGING_*_DATABASE_URL`            | Staging    | Connection strings for the 6 staging PostgreSQL databases    |
| `PROD_*_DATABASE_URL`               | Production | Connection strings for the 6 production PostgreSQL databases |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Both       | Clerk frontend authentication publishable key                |
| `CLERK_SECRET_KEY`                  | Both       | Clerk backend authentication secret key                      |
| `STRIPE_SECRET_KEY`                 | Both       | Stripe API secret key for payment sessions                   |
| `STRIPE_WEBHOOK_SECRET`             | Both       | Stripe webhook signing secret                                |

### 2.2 Kubernetes Secret Injection

In staging and production namespaces, create the shared secret `larekmart-secrets`:

```bash
kubectl create secret generic larekmart-secrets \
  --namespace larekmart \
  --from-literal=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  --from-literal=CLERK_SECRET_KEY="sk_live_..." \
  --from-literal=STRIPE_SECRET_KEY="sk_live_..." \
  --from-literal=STRIPE_WEBHOOK_SECRET="whsec_..." \
  --from-literal=JWT_SECRET="super-secure-jwt-key" \
  --from-literal=MONGO_URI="mongodb+srv://..." \
  --from-literal=KAFKA_BROKERS="kafka-0.kafka:9092,kafka-1.kafka:9092" \
  --from-literal=REDIS_URL="redis://:password@redis-master:6379" \
  --from-literal=OPENSEARCH_NODE="http://opensearch-cluster:9200"
```

---

## 3. Database Migration Procedures

Database schemas must always follow the **Expand / Contract** pattern. Zero-downtime rolling updates require backward compatibility:

1. **Expand**: Add new nullable columns, tables, or indexes. Never drop active columns or change types in a forward migration.
2. **Deploy Code**: Deploy application containers that write to both new and old columns or read new schemas.
3. **Contract**: In a subsequent release, remove legacy columns or constraints after all old containers are replaced.

### 3.1 Automated Migrations via CI/CD

Both `.github/workflows/staging.yml` and `.github/workflows/production.yml` run safe database deployments before application containers are rolled out:

```bash
# Prisma deployments (Non-interactive, checks schema engine, rejects drift)
pnpm --filter @repo/product-db db:deploy
pnpm --filter @repo/inventory-db db:deploy
pnpm --filter @repo/catalog-db db:deploy
pnpm --filter @repo/shipping-db db:deploy
pnpm --filter @repo/user-db db:deploy

# Drizzle deployment for media-service
pnpm --filter media-service db:migrate
```

### 3.2 Manual / Emergency Migration Execution

Use the GitHub Actions manual workflow `.github/workflows/migrate.yml`:

1. Navigate to **Actions** -> **Database Migration Utility**.
2. Select target database (or `all`).
3. Select target environment (`staging` or `production`).
4. Select action (`status` to inspect pending migrations, or `deploy` to execute).
5. Click **Run workflow**.

---

## 4. Staging Deployment Procedure

Staging deployments occur automatically upon push to the `staging` branch:

1. **Code Validation**: Fast-fail gates run lint, format, typecheck, unit tests, Go race checks, Python pytest, and build validation.
2. **Container Build**: Multi-architecture container builds for `base-node` and 18 microservices, pushed to GHCR with tags `staging` and `staging-${SHA_SHORT}`.
3. **Trivy Vulnerability Scan**: All images scanned for CRITICAL and HIGH CVEs.
4. **Database Migration**: Safe Prisma and Drizzle deployments applied to staging database instances.
5. **Kubernetes Rollout**: Kustomize overlay `infrastructure/kubernetes/overlays/staging` applied to namespace `larekmart-staging`.
6. **Synthetic Traffic Verification**: Executes `scripts/verify-staging-traffic.sh https://staging.larekmart.com`. Tests:
   - Frontends (client, admin)
   - API Gateway routing to all 14 backend domain services
   - WebSocket upgrade endpoints
   - CORS and security headers
7. **Rollback**: If any deployment or synthetic health check fails, GitHub Actions triggers `kubectl rollout undo` on all staging deployments automatically.

---

## 5. Production Deployment Procedure

Production deployments follow a gated release process:

### 5.1 Pre-Deployment Steps

1. Ensure all changes have completed verification in `staging`.
2. Create and merge a Pull Request from `staging` into `main`.
3. The merge push triggers `.github/workflows/production.yml`.

### 5.2 Release Stages & Approval Gate

1. **Quality Gates**: Reusable workflow verifies complete monorepo test and build integrity.
2. **Container Image Promotion**: Container images with the immutable commit SHA `${SHA_SHORT}` are tagged with `latest` and `production-${SHA_SHORT}`.
3. **Production Approval Gate**: The pipeline pauses at GitHub Environment `production`. Designated release engineers must review the release diff and approve the execution.
4. **Production DB Migrations**: `migrate-production` applies safe database migrations with `db:deploy`.
5. **Zero-Downtime Rolling Update**:
   - `deploy-production` applies `infrastructure/kubernetes/overlays/production`.
   - Kubernetes runs rolling updates (`maxSurge: 25%`, `maxUnavailable: 0`).
   - Watches rollout status on all 17 deployments for up to 300 seconds.
6. **Live Production Health Verification**:
   - Probes storefront, admin, and core API health routes (`/api/v1/products/health`, `/api/v1/catalog/health`, etc.).

---

## 6. Rollback Procedures

### 6.1 Automated Rollback

If a deployment fails readiness probes or health verification during CI/CD execution, the pipeline immediately runs:

```bash
DEPLOYMENTS=(
  client admin product-service order-service payment-service auth-service
  analytic-service notification-service search-service inventory-service
  recommendation-service cart-service catalog-service shipping-service
  user-service media-service email-service
)
for dep in "${DEPLOYMENTS[@]}"; do
  kubectl rollout undo deployment/"${dep}" -n larekmart
done
```

### 6.2 Manual Immediate Rollback

If an issue is detected after a release has completed successfully:

```bash
# 1. Check revision history
kubectl rollout history deployment/product-service -n larekmart

# 2. Roll back a specific service to the previous revision
kubectl rollout undo deployment/product-service -n larekmart

# 3. Or roll back to a specific known revision number
kubectl rollout undo deployment/product-service -n larekmart --to-revision=2

# 4. Monitor rollout status
kubectl rollout status deployment/product-service -n larekmart
```

### 6.3 Database Rollback Runbook

Prisma does not support automatic down migrations in `db:deploy` to protect data safety. If a migration needs to be rolled back:

1. Write a corrective forward migration (e.g., `pnpm --filter @repo/product-db prisma migrate dev --name rollback_feature`).
2. Deploy the forward migration via `.github/workflows/migrate.yml` or manual CI/CD deployment.
3. In extreme data corruption incidents, restore the pre-migration snapshot from database backups:
   - AWS RDS: Restore Point-in-Time Snapshot.
   - MongoDB Atlas: Restore Continuous Backup Snapshot.

---

## 7. Verification Checklist

Before signing off on any production release:

- [ ] `pnpm format:check` and `pnpm lint` pass cleanly.
- [ ] `pnpm check-types` completes without errors across all 42 monorepo packages.
- [ ] All 27 workspace test suites pass (`pnpm test`).
- [ ] Go notification service tests pass with `-race` flag (`go test -race ./...`).
- [ ] Python recommendation service passes `uv run pytest tests/ -q` (34/34 passing).
- [ ] All container images successfully built and scanned by Trivy without CRITICAL CVEs.
- [ ] Kubernetes manifests validate with `kubectl kustomize infrastructure/kubernetes/overlays/production`.
- [ ] Declarative Chaos Mesh manifests validate with `kubectl kustomize infrastructure/chaos/`.
- [ ] Horizontal Pod Autoscalers (HPA v2) active for `api-gateway` (3-30 pods), `order-service` (3-25 pods), and `inventory-service` (3-30 pods).
- [ ] Pod Disruption Budgets (PDBs) verified across core services (`minAvailable: 1-2`).
- [ ] Production environment approval granted by authorized reviewer.
- [ ] Zero-downtime rolling update completed across all 26 Kubernetes workloads.
- [ ] Production health check endpoints return HTTP 200.

