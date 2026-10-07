# Argo CD GitOps for Larekmart

This directory contains the declarative GitOps engine for the Larekmart e-commerce platform using **Argo CD**.

## Architecture

Larekmart uses the **App of Apps** and **ApplicationSet** patterns:

```
                  ┌──────────────────────┐
                  │  larekmart-root App  │
                  └──────────┬───────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
│  Dev App    │       │ Staging App │       │  Prod App   │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
overlays/development   overlays/staging      overlays/production
```

## Prerequisites

- Kubernetes 1.28+ cluster (EKS, GKE, or local Minikube/Kind)
- `kubectl` configured with cluster admin context
- `helm` 3.12+

## Quick Start / Installation

### 1. Install Argo CD via Helm

```bash
# Add Argo Helm repo
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Create namespace and install
kubectl create namespace argocd
helm install argocd argo/argo-cd \
  --namespace argocd \
  --values infrastructure/argocd/values.yaml
```

### 2. Retrieve Initial Admin Password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
```

### 3. Bootstrap the GitOps Project & Root App

```bash
# 1. Apply Project definitions & RBAC
kubectl apply -f infrastructure/argocd/project.yaml

# 2. Apply Root App (automatically synchronizes all child apps)
kubectl apply -f infrastructure/argocd/root-app.yaml

# (Optional) Or apply ApplicationSet for dynamic multi-env matrix
kubectl apply -f infrastructure/argocd/applicationsets/environments-appset.yaml
```

### 4. Access Argo CD Web UI

```bash
# Port-forward to localhost:8080
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Open [https://localhost:8080](https://localhost:8080) and log in with username `admin` and the password retrieved above.

---

## Directory Structure

| File / Folder                         | Purpose                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `project.yaml`                        | `AppProject` CRD defining allowed source repos, target clusters, namespaces, and RBAC |
| `root-app.yaml`                       | Root Application following the "App of Apps" pattern                                  |
| `values.yaml`                         | Production Helm values (HA Redis, autoscaling, ingress, monitoring)                   |
| `applications/`                       | Individual environment and platform applications                                      |
| `applications/larekmart-dev.yaml`     | Auto-syncing development environment application                                      |
| `applications/larekmart-staging.yaml` | Staging environment application                                                       |
| `applications/larekmart-prod.yaml`    | Production environment application (manual prune safety)                              |
| `applications/ingress-nginx.yaml`     | Ingress NGINX controller application                                                  |
| `applications/observability.yaml`     | Kube-Prometheus-Stack monitoring application                                          |
| `applicationsets/`                    | Dynamic ApplicationSet generator templates                                            |
