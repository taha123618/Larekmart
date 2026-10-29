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
│   ├── services/                  # 23 microservices deployments & services (26 total workloads)
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
2. **High Availability & Pod Disruption Budgets (PDB)**:
   - Deployments default to 2+ replicas across worker nodes.
   - `PodDisruptionBudget` guarantees high availability during node drain or cluster upgrades (`api-gateway-pdb` with `minAvailable: 2`, `inventory-service-pdb` with `minAvailable: 1`).
3. **Hyperscale Autoscaling (HPA)**:
   - Critical path services scale dynamically under peak load: `api-gateway` (3–30 pods), `inventory-service` (3–30 pods), `order-service` (3–25 pods), and `client`/`catalog-service`/`search-service` (2–10 pods) when CPU exceeds 70% or Memory exceeds 80%.
4. **Chaos Engineering & Resilience**:
   - Resilience against pod evictions, database partitions, and broker failures is continuously validated using declarative Chaos Mesh CRDs (`infrastructure/chaos/`).
5. **Zero-Trust Network Isolation**:
   - `default-deny-all` blocks arbitrary pod-to-pod communication.
   - Only the Ingress controller and authorized services can communicate on designated ports. Direct service-to-service HTTP is blocked, upholding the asynchronous Kafka architecture.
6. **Security Hardening**:
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
- All microservice health endpoints (`/api/v1/*/health`, including `/api/v1/promotions/health`).
- WebSocket upgrade route `/ws` on `notification-service`.
- CORS preflight headers (`Access-Control-Allow-Origin`).
- Defensive HTTP security headers (`X-Content-Type-Options`).

---

## 7. Infrastructure YAML & `apiVersion` Architecture Guide

An audit of all 62 YAML files across `infrastructure/*` establishes `apiVersion` consistency across the entire repository.

Here is the exact classification of where `apiVersion` is needed, where it was updated, and where it must **not** be added:

### 1. Where `apiVersion` Was Needed & Updated

In Kubernetes, custom resource versions graduate as operators mature. The following files were updated to the current production API version:

| File                                                           | Resource Kind        | Previous `apiVersion`         | Updated `apiVersion`     | Status             |
| :------------------------------------------------------------- | :------------------- | :---------------------------- | :----------------------- | :----------------- |
| `infrastructure/kubernetes/base/secrets/external-secrets.yaml` | `ExternalSecret`     | `external-secrets.io/v1beta1` | `external-secrets.io/v1` | Updated & Verified |
| `infrastructure/kubernetes/base/secrets/secret-store.yaml`     | `SecretStore`        | `external-secrets.io/v1beta1` | `external-secrets.io/v1` | Updated & Verified |
| `infrastructure/kubernetes/base/secrets/secret-store.yaml`     | `ClusterSecretStore` | `external-secrets.io/v1beta1` | `external-secrets.io/v1` | Updated & Verified |

### 2. Kubernetes Manifests Specifying Proper `apiVersion`

Every single Kubernetes manifest in `infrastructure/kubernetes/` and GitOps application in `infrastructure/argocd/` specifies the exact production `apiVersion`:

- **Microservice & Frontend Deployments** (19 services): `apiVersion: apps/v1`
- **Cluster Services, Namespaces, Secrets, ConfigMaps**: `apiVersion: v1`
- **Ingress & Network Policies**: `apiVersion: networking.k8s.io/v1`
- **Horizontal Pod Autoscalers (HPAs)**: `apiVersion: autoscaling/v2`
- **Pod Disruption Budgets (PDBs)**: `apiVersion: policy/v1`
- **KEDA Autoscaling** (`TriggerAuthentication`, `ScaledObject`): `apiVersion: keda.sh/v1alpha1`
- **Kustomize Assemblers** (`kustomization.yaml`): `apiVersion: kustomize.config.k8s.io/v1beta1`
- **Argo CD** (`Application`, `ApplicationSet`, `AppProject`): `apiVersion: argoproj.io/v1alpha1`

### 3. Files Where `apiVersion` Must NOT Be Added (And Why `kubectl` Complained)

When running `kubectl apply -R -f <dir>`, `kubectl` recursively attempts to parse every single `.yaml` / `.yml` file as a Kubernetes API server resource. The following files fail with `[apiVersion not set, kind not set]` if run with `kubectl apply -f` because they are **not** Kubernetes manifests:

#### A. Helm Values Files

- `infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml`
- `infrastructure/argocd/values.yaml`
- **Why**: These are parameter files for the `helm upgrade --install` command. Helm expects a plain key-value dictionary (e.g. `controller.replicaCount: 2`). Adding `apiVersion` or `kind` breaks Helm chart parameter parsing.
- **How to deploy**:
  - Local Minikube: `minikube addons enable ingress`
  - Cloud / Staging: `helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx -f infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml`

#### B. Observability Daemon Configurations

- `infrastructure/observability/alertmanager/alertmanager.yml` (Alertmanager configuration)
- `infrastructure/observability/prometheus/prometheus.yml` (Prometheus scraper configuration)
- `infrastructure/observability/prometheus/rules/alerts.yml` (Prometheus alert rules)
- `infrastructure/observability/loki/loki.yml` (Loki log storage configuration)
- `infrastructure/observability/promtail/promtail.yml` (Promtail log collector configuration)
- `infrastructure/observability/grafana/provisioning/*/*.yml` (Grafana provider definitions)
- **Why**: These are mounted directly by the container engines in `docker-compose.observability.yml`. Adding `apiVersion: ...` causes Prometheus, Loki, and Alertmanager binaries to crash on startup with YAML unmarshaling errors.
- **How to deploy**:
  - Locally: `docker compose -f docker-compose.observability.yml up -d`
  - On Kubernetes: Via `helm upgrade --install prometheus prometheus-community/kube-prometheus-stack -n monitoring`

#### C. Ansible Playbooks & Roles

- `infrastructure/ansible/**/*.yml` (Playbooks, task lists, inventories)
- **Why**: These are executed by the Ansible automation engine (`ansible-playbook`), not Kubernetes.

---

### Summary of Correct Deployment Commands

| Target Component                     | Correct Command (Never run `kubectl apply -R -f` across mixed directories)                                                                                                       |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Larekmart Workloads (Local/Dev)**  | `kubectl apply -k infrastructure/kubernetes/overlays/development`                                                                                                                |
| **Larekmart Workloads (Staging)**    | `kubectl apply -k infrastructure/kubernetes/overlays/staging`                                                                                                                    |
| **Larekmart Workloads (Production)** | `kubectl apply -k infrastructure/kubernetes/overlays/production`                                                                                                                 |
| **Ingress Controller (Minikube)**    | `minikube addons enable ingress`                                                                                                                                                 |
| **Ingress Controller (Helm)**        | `helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx -f infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml -n ingress-nginx --create-namespace` |
| **Observability (Docker)**           | `docker compose -f docker-compose.observability.yml up -d`                                                                                                                       |
| **Observability (Kubernetes)**       | `helm upgrade --install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace`                                                                  |
