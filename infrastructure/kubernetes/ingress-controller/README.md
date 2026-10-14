# NGINX Ingress Controller Configuration

This directory contains the custom Helm values configuration for the NGINX Ingress Controller deployed in Larekmart.

> **Note**: `ingress-nginx-values.yaml` is a **Helm values file**, not a raw Kubernetes manifest. Do not run `kubectl apply -f` directly on this file.

---

## Deployment Instructions

### 1. Local Development (Minikube)

On local Minikube, enable the built-in NGINX Ingress addon:

```bash
minikube addons enable ingress
```

Then in a separate terminal, start the tunnel to route ingress traffic:

```bash
minikube tunnel
```

---

### 2. Staging & Production (Using Helm)

For staging and production clusters (EKS, GKE, bare-metal), deploy via the official Helm chart using our tuned values:

```bash
# 1. Add and update the ingress-nginx chart repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# 2. Deploy or upgrade the ingress controller
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  -f infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml
```

---

## Configuration Highlights in `ingress-nginx-values.yaml`

- **High Availability**: 2 replicas with Horizontal Pod Autoscaler (HPA) scaling up to 8 pods.
- **Performance & Buffering**: Configured for `25m` body sizes, gzip, Brotli compression, and 600s proxy timeouts for long-lived operations.
- **Security Hardening**: HSTS enabled, TLS v1.2/v1.3 with modern secure ciphers, hidden server tokens.
- **WebSocket Support**: Native proxying for `notification-service` WebSocket connections (`/ws`).
- **Telemetry**: Exposes Prometheus metrics and configures ServiceMonitor for Prometheus operator.
