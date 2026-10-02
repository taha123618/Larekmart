# Larekmart Kubernetes Architecture & Operations

This directory contains the production-grade **Kubernetes manifests and Kustomize overlays** for deploying the Larekmart microservices platform.

## Directory Structure

```text
infrastructure/kubernetes/
├── base/                          # Declarative base configuration
│   ├── namespace.yaml             # larekmart namespace
│   ├── configmaps/                # Environment configuration
│   ├── secrets/                   # Template secret references
│   ├── ingress.yaml               # SSL-terminated Ingress with CORS & WebSocket support
│   ├── frontends/                 # Storefront & Admin dashboard
│   ├── services/                  # 12 microservices deployments & services
│   ├── workers/                   # Headless Kafka consumers (email-service)
│   ├── autoscaling/               # Horizontal Pod Autoscalers (HPA)
│   ├── pdb/                       # Pod Disruption Budgets (minAvailable: 1)
│   ├── network-policies/          # Strict microservice & DB isolation
│   └── kustomization.yaml         # Base manifest assembler
│
├── overlays/                      # Environment-specific overlays
│   ├── development/               # 1 replica, local dev hostnames
│   ├── staging/                   # Staging cluster configuration
│   └── production/                # High availability, immutable tags
│
└── README.md                      # This guide
```

---

## 1. Quick Start: Local Testing with Kind or Minikube

### Validate Kustomize Build

Ensure your manifests synthesize cleanly without syntax errors:

```bash
kubectl kustomize infrastructure/kubernetes/overlays/development
```

### Apply Development Overlay

```bash
kubectl apply -k infrastructure/kubernetes/overlays/development
```

### Check Rollout Status

```bash
kubectl rollout status deployment/product-service -n larekmart-dev
kubectl rollout status deployment/client -n larekmart-dev
kubectl get pods,svc,ingress,hpa -n larekmart-dev
```

---

## 2. Deploying to Staging & Production

### Staging

```bash
kubectl apply -k infrastructure/kubernetes/overlays/staging
```

### Production

```bash
kubectl apply -k infrastructure/kubernetes/overlays/production
```

---

## 3. Core Architectural Guarantees

1. **Zero-Downtime Deployments**:
   - Every Deployment uses `RollingUpdate` with `maxSurge: 25%` and `maxUnavailable: 0`.
   - Liveness, Readiness, and Startup probes prevent traffic from reaching pods until they are ready to accept requests.
2. **High Availability**:
   - Deployments default to 2+ replicas across worker nodes.
   - `PodDisruptionBudget` guarantees at least 1 replica remains active during node upgrades or draining.
3. **Autoscaling (HPA)**:
   - High-throughput services (`client`, `catalog-service`, `search-service`, `cart-service`, `order-service`) scale dynamically up to 10 replicas when CPU exceeds 70% or Memory exceeds 80%.
4. **Zero-Trust Network Isolation**:
   - `default-deny-all` blocks arbitrary pod-to-pod communication.
   - Only the Ingress controller and authorized services can communicate on designated ports. Direct service-to-service HTTP is blocked, upholding the asynchronous Kafka architecture.
5. **Security Hardening**:
   - All pods run as non-root user `1000:1000`.
   - Privilege escalation is disabled (`allowPrivilegeEscalation: false`).
   - Linux capabilities are dropped (`drop: ["ALL"]`).

---

## 4. External Secrets Operator (ESO)

Production secret synchronization is managed via `ExternalSecret` and `SecretStore` resources located in `base/secrets/`:

- **SecretStore (`secret-store.yaml`)**: Connects to AWS Secrets Manager (`SecretsManager` provider in `us-east-1` with IRSA) and HashiCorp Vault (`ClusterSecretStore`).
- **ExternalSecret (`external-secrets.yaml`)**: Continuously syncs keys into `larekmart-secrets` every `1h`:
  - `POSTGRES_PASSWORD`, `MONGODB_URI`, `MONGODB_CART_URI`
  - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `REDIS_PASSWORD`, `OPENSEARCH_INITIAL_ADMIN_PASSWORD`

Deploy ESO:
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```

---

## 5. KEDA Event-Driven Autoscaling

In addition to resource-based HPA (CPU/memory), event-driven workloads scale on **Kafka partition lag** via KEDA `ScaledObject` in `base/autoscaling/keda-scaledobjects.yaml`:

- **`email-service-scaledobject`**: Scales from 1 to 8 replicas when consumer group lag (`email-service-group`) on topics `order.created`, `order.status_updated`, or `user.registered` exceeds 25 messages per pod.
- **`notification-service-scaledobject`**: Scales from 2 to 10 replicas when lag on `notification.send` exceeds 50 messages per pod.

Deploy KEDA:
```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n keda --create-namespace
```

---

## 6. Staging Ingress Setup & Traffic Verification

Deploy NGINX Ingress Controller using project-tuned Helm values:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace \
  -f infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml
```

Run the automated synthetic traffic and route verification suite:

```bash
# Test against staging ingress:
pnpm test:staging:traffic https://staging.larekmart.com

# Test against local ingress port-forward:
pnpm test:staging:traffic http://localhost:80
```

The test validates:
- Next.js Storefront (`client`) and Admin Portal (`admin`) HTTP 200/30x resolution.
- All 14 microservice health endpoints (`/api/v1/*/health`).
- WebSocket upgrade route `/ws` on `notification-service`.
- CORS preflight headers (`Access-Control-Allow-Origin`).
- Defensive HTTP security headers (`X-Content-Type-Options`).

