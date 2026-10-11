# Full-Stack DevOps & Infrastructure Comparison

## Caddy vs. NGINX with Traefik vs. Docker vs. Kubernetes vs. GitHub Actions

This document details how each layer of the DevOps, containerization, orchestration, ingress, and automation architecture fits together for the **Larekmart** microservices platform.

---

## 1. Executive Summary & Layered Architecture

These tools are not competitors in a single zero-sum category—they operate across **four complementary layers** of the modern cloud-native infrastructure stack:

```
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: CI/CD & AUTOMATION                                            │
│ 🏆 GitHub Actions (Builds images, runs tests, triggers deployments)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LAYER 2: CONTAINER PACKAGING                                           │
│ 🏆 Docker (Builds lightweight OCI container images for all 15 services)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │                                                     │
┌────────▼────────────────────────────┐ ┌──────────────────────▼─────────┐
│ LAYER 3A: LOCAL DEV ORCHESTRATION   │ │ LAYER 3B: PRODUCTION CLUSTER   │
│ 🏆 Docker Compose                   │ │ 🏆 Kubernetes (AWS EKS/GCP GKE)│
│ • Single-host workstation loop      │ │ • Multi-node autoscaling (HPA) │
│ • Fast, isolated development        │ │ • Multi-AZ resilience          │
└────────┬────────────────────────────┘ └──────────────┬─────────────────┘
         │                                             │
┌────────▼────────────────────────────┐ ┌──────────────▼─────────────────┐
│ LAYER 4A: LOCAL DEV INGRESS         │ │ LAYER 4B: PRODUCTION INGRESS   │
│ 🏆 Traefik (+ NGINX sidecar)        │ │ 🏆 NGINX Ingress Controller    │
│ • Dynamic Docker label discovery    │ │ • High-concurrency epoll kernel│
│ • Real-time web dashboard (:8088)   │ │ • Granular timeout/buffer spec │
└─────────────────────────────────────┘ └────────────────────────────────┘
```

---

## 2. Layer-by-Layer Architectural Evaluation

### Layer 1: CI/CD & Automation ➔ **Winner: GitHub Actions**

- **Role:** Continuous Integration & Delivery engine.
- **Why it's essential:** It doesn't compete with Docker or Kubernetes; it orchestrates them.
- **Responsibilities in Larekmart:**
  1. **Monorepo Validation:** Runs Turborepo type checks (`pnpm check-types`), test suites (`pnpm test`), and linting across all workspaces.
  2. **Multi-Arch Builds:** Uses `docker/build-push-action` to build production images for ARM64 and AMD64.
  3. **Security Gates:** Runs **Trivy** vulnerability scanning on Docker images and gates PRs on high/critical CVEs.
  4. **Continuous Deployment:** Updates Kubernetes manifests (`infrastructure/kubernetes/overlays/`) or triggers ArgoCD GitOps reconciliation.

---

### Layer 2: Container Packaging ➔ **Winner: Docker**

- **Role:** Standardized, reproducible application runtime packaging.
- **Why it's essential:** Kubernetes does not replace Docker; **Kubernetes executes Docker OCI images**.
- **Responsibilities in Larekmart:**
  - Multi-stage Dockerfiles across all 15 microservices (`apps/`), 2 Next.js frontends (`admin`, `client`), and background workers (`media-worker`, `media-cleanup`, `email-service`).
  - Standardized non-root execution (`USER node` / `USER nonroot`) for container security hardening.

---

### Layer 3: Orchestration ➔ **Docker Compose vs. Kubernetes**

| Dimension               | **Docker Compose**                                   | **Kubernetes**                                                            |
| :---------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------ |
| **Best Environment**    | **Local Development & Single-Host Testing**          | **Production Cloud (AWS EKS, GCP GKE, Bare Metal)**                       |
| **Cluster Topology**    | Single host daemon (`/var/run/docker.sock`)          | Distributed master/worker nodes across multiple Availability Zones        |
| **Replica Autoscaling** | Manual scaling (`--scale service=N`)                 | Automated Horizontal Pod Autoscaler (HPA) based on CPU/RAM/Custom metrics |
| **Self-Healing**        | Simple container restart policies (`unless-stopped`) | Pod rescheduling, node drain/cordon, readiness & liveness probes          |
| **Rolling Deployments** | Container recreated sequentially (brief drop)        | Zero-downtime rolling updates, canary releases, blue-green deployments    |
| **Verdict**             | **Best for developer laptop inner loop**             | **Mandatory for Amazon / AliExpress scale production**                    |

---

### Layer 4: Ingress & Reverse Proxy ➔ **Traefik vs. NGINX vs. Caddy**

| Dimension             | **Traefik v3**                         | **NGINX (Ingress Controller)**             | **Caddy**                             |
| :-------------------- | :------------------------------------- | :----------------------------------------- | :------------------------------------ |
| **Best Environment**  | **Docker Compose (Local / Staging)**   | **Kubernetes (Production)**                | **Standalone Dev Prototyping**        |
| **Service Discovery** | **Automatic via Docker Engine labels** | **Automatic via Kubernetes Endpoints API** | Manual (Static `Caddyfile` upstreams) |
| **Performance Model** | Goroutine event-driven (Go)            | Non-blocking `epoll` event loop (C)        | Goroutine event-driven (Go)           |
| **Configuration**     | Decentralized in service labels        | Declarative Helm values / Ingress CRDs     | Centralized in one `Caddyfile`        |
| **Visual Dashboard**  | Built-in UI on port `8088`             | None (Exported to Grafana/Prometheus)      | None                                  |
| **Verdict**           | **Winner for Docker Compose**          | **Winner for Kubernetes Production**       | Optional profile (`--profile caddy`)  |

---

## 3. What About "NGINX with Traefik"?

In `docker-compose.dozzle.yml`, Larekmart implements an established two-tier design pattern:

- **Edge Layer (Traefik):** Terminates TLS, inspects host headers (`logs.localhost`), and routes public requests into the internal bridge network (`larekmart-network`).
- **Internal Layer (NGINX Sidecar):** Fronts Dozzle (`docker/nginx/nginx.conf`) to provide:
  - 100MB body upload buffering.
  - Dedicated Server-Sent Events (SSE) and WebSocket connection upgrade headers (`Connection "Upgrade"`, `proxy_read_timeout 3600s`).
  - Response buffering bypass for unbuffered log streaming.

This pattern prevents bloating the primary edge gateway configuration while giving specialized services tailored buffer configurations.

---

## 4. The Unified Production Blueprint for Larekmart

```
Step 1: Developer writes code locally
        └── Tested via Docker Compose + Traefik (:8088) + Dozzle (:8085)

Step 2: Developer pushes commit to GitHub
        └── GitHub Actions runs pnpm check-types + pnpm test + Trivy scan

Step 3: GitHub Actions builds Docker images
        └── Pushes images to AWS ECR / GitHub Packages (GHCR)

Step 4: Kubernetes deploys application
        └── NGINX Ingress Controller (:80 / :443) routes traffic to services
        └── HPA autoscales pods based on traffic surges
        └── Prometheus + Grafana (:3001) monitors latency and Kafka lag
```

---

## 5. Decision Summary Table

| Tool               | Status in Larekmart             | Recommended Role                                                                   |
| :----------------- | :------------------------------ | :--------------------------------------------------------------------------------- |
| **GitHub Actions** | **Adopted (Core)**              | Automated CI/CD, testing, Docker builds, and security scans.                       |
| **Docker**         | **Adopted (Core)**              | Standard container image packaging for all services and workers.                   |
| **Docker Compose** | **Adopted (Core Dev)**          | Rapid local development workstation inner loop.                                    |
| **Kubernetes**     | **Adopted (Core Prod)**         | High-availability multi-node production deployment (`infrastructure/kubernetes/`). |
| **Traefik v3**     | **Adopted (Core Dev Ingress)**  | Dynamic edge ingress router for Docker Compose environments.                       |
| **NGINX Ingress**  | **Adopted (Core Prod Ingress)** | Production Kubernetes ingress controller (`ingress-nginx-values.yaml`).            |
| **NGINX Sidecar**  | **Adopted (Specialized)**       | Dedicated 100MB buffer & SSE streaming proxy for Dozzle.                           |
| **Caddy**          | **Maintained (Optional)**       | Standalone reverse-proxy profile (`--profile caddy`) for simple setups.            |
