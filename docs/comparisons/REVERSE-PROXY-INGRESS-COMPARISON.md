# Reverse Proxy & Ingress Architecture Evaluation

## Caddy vs. NGINX vs. Traefik (and NGINX with Traefik)

This document provides the definitive architectural evaluation, trade-off analysis, and production guidelines for the reverse proxy and ingress routing layers in the **Larekmart** microservices monorepo.

---

## 1. Executive Summary & The Definitive Verdict

For **Larekmart** (15 microservices, 2 Next.js frontends, dynamic replica autoscaling, asynchronous Kafka event broker, and polyglot databases), the best reverse proxy depends on the deployment runtime:

### 🏆 The Verdict by Deployment Runtime

| Deployment Target                               | Best Choice                     | Key Architectural Reason                                                                                                                                                                                       |
| :---------------------------------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Compose** _(Local Dev & Staging)_      | **🥇 Traefik v3**               | **Dynamic Container Discovery via Labels.** Automatically detects container creation, teardown, and horizontal replica scaling (`--scale service=N`) with zero configuration reloads.                          |
| **Kubernetes** _(Production Cloud / EKS / GKE)_ | **🥇 NGINX Ingress Controller** | **Battle-Tested High-Concurrency Standard.** Kernel-level epoll event loop, fine-grained buffer and timeout tuning, ModSecurity WAF, and native `cert-manager` integration.                                    |
| **Edge Ingress + Sidecar Buffer**               | **🥈 Traefik + NGINX**          | **Two-Tier Architecture.** Traefik handles edge TLS and subdomain routing (`logs.localhost`); internal NGINX sidecars handle specialized payload buffering (e.g. 100MB body limit & SSE streaming for Dozzle). |
| **Developer Prototyping**                       | **🥉 Caddy**                    | **Simplest syntax and automatic local TLS.** Excellent for standalone developer tasks, but lacks native Docker socket dynamic service discovery without third-party plugins.                                   |

---

## 2. Head-to-Head Feature Matrix

| Capability / Metric               | **Traefik v3** (`docker-compose.traefik.yml`) | **NGINX Ingress** (`ingress-nginx-values.yaml`) |     **Caddy** (`Caddyfile`)      |
| :-------------------------------- | :-------------------------------------------: | :---------------------------------------------: | :------------------------------: |
| **Service Discovery Mechanism**   |        **Docker Engine API (Labels)**         |          **Kubernetes Endpoints API**           |  Manual (Static upstream file)   |
| **Dynamic Replica Scaling**       |           ✅ Automatic round-robin            |           ✅ Automatic pod discovery            |  ❌ Requires file edit & reload  |
| **Automated TLS (Let's Encrypt)** |      ✅ Built-in ACME HTTP/DNS challenge      |        ✅ Handled via K8s `cert-manager`        | ✅ Built-in ACME automatic HTTPS |
| **WebSockets & SSE Streaming**    |          ✅ Native HTTP/1.1 Upgrade           |         ✅ Tuned in ConfigMap / values          |    ✅ Native HTTP/1.1 Upgrade    |
| **Real-time Visual Dashboard**    |           ✅ Web UI on port `8088`            |          ❌ None (Prometheus/Grafana)           |             ❌ None              |
| **Config Location**               |        Decentralized in service labels        |         Declarative Helm values / CRDs          |  Single centralized `Caddyfile`  |
| **Memory Footprint**              |                  ~50 MB RAM                   |          ~100–250 MB RAM (per replica)          |            ~40 MB RAM            |
| **Production Adoption**           |   High (Edge router & Docker environments)    |        **#1 Market Share (Kubernetes)**         |    Medium (SMBs & monoliths)     |

---

## 3. Deep-Dive: Each Technology in Larekmart

### 3.1 Traefik v3: The Docker Ingress Winner

In `docker-compose.traefik.yml` and `docker-compose.yml`, Traefik serves as the primary ingress gateway for the entire container ecosystem.

#### Key Architectural Strengths:

1. **Decentralized Service Ownership:**
   Instead of editing a single monolithic config file whenever a microservice is added or modified, each service configures its routing rules directly within its own Docker Compose block:
   ```yaml
   labels:
     - "traefik.enable=true"
     - "traefik.docker.network=larekmart-network"
     - "traefik.http.routers.api-gateway.rule=Host(`api.localhost`)"
     - "traefik.http.services.api-gateway.loadbalancer.server.port=8090"
   ```
2. **Dynamic Zero-Downtime Scaling:**
   When scaling an individual service horizontally:
   ```bash
   docker compose up -d --scale order-service=3
   ```
   Traefik listens to the Docker daemon socket, discovers the IP addresses of all 3 running containers, and automatically distributes traffic using weighted round-robin.
3. **Observability Dashboard:**
   Traefik provides a real-time visual web dashboard at `http://localhost:8088` showing all active routers, TLS certificates, services, and middlewares.

---

### 3.2 NGINX Ingress Controller: The Kubernetes Winner

Configured in `infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml`, the official Kubernetes NGINX Ingress Controller is the production standard for cloud deployments.

#### Key Architectural Strengths:

1. **C10K Concurrency & Kernel Performance:**
   NGINX is written in C and uses the asynchronous non-blocking Linux `epoll` system call. Under heavy Black Friday / flash-sale e-commerce traffic, it routes tens of thousands of concurrent requests with minimal CPU overhead.
2. **Granular Buffer & Timeout Tuning:**
   The `ingress-nginx-values.yaml` in this repository specifically tunes:
   - `proxy-body-size: "25m"`: Supports image and asset uploads to `media-service`.
   - `proxy-read-timeout: "600"`: Prevents gateway timeouts on long-running Stripe checkout webhooks and reporting jobs.
   - `keep-alive-requests: "10000"`: Minimizes TCP handshake latency for high-frequency storefront queries.
3. **Horizontal Pod Autoscaling (HPA):**
   ```yaml
   autoscaling:
     enabled: true
     minReplicas: 2
     maxReplicas: 8
     targetCPUUtilizationPercentage: 75
     targetMemoryUtilizationPercentage: 80
   ```
   NGINX ingress replicas automatically scale out during traffic surges and scale in during idle periods.

---

### 3.3 The "Traefik + NGINX" Two-Tier Pattern

In `docker-compose.dozzle.yml`, Larekmart uses a hybrid two-tier architecture:

- **Tier 1 — Edge Ingress (Traefik):**
  Listens on ports `80` and `443`, terminates SSL, and inspects incoming Host headers (`logs.localhost`).
- **Tier 2 — Service-Specific Buffer (NGINX Sidecar):**
  Traefik routes traffic to `larekmart-logs-nginx` (`docker/nginx/nginx.conf`), which enforces:
  - `client_max_body_size 100M`
  - Explicit HTTP/1.1 WebSocket & SSE proxy headers (`Connection "Upgrade"`, `proxy_read_timeout 3600s`)
  - Response buffering bypass for real-time log streaming.

**Why this works:** It keeps edge ingress rules standardized and clean, while allowing specialized workloads to have dedicated buffering rules without affecting global routing.

---

### 3.4 Caddy: Standalone Simplicity

Configured in `docker-compose.caddy.yml` and `Caddyfile`:

- Caddy is known for its human-readable syntax and built-in automatic HTTPS provisioning.
- In Larekmart, it is maintained under the `--profile caddy` flag as a lightweight alternative for developers who prefer running a single static reverse proxy file rather than Docker socket label discovery.

---

## 4. Production Recommendations for Larekmart

1. **Local Development & Docker Compose:**
   Run **Traefik** as your primary gateway (`docker compose -f docker-compose.traefik.yml up -d`).
   Access the dashboard at `http://localhost:8088`.
2. **Dozzle Log Streaming:**
   Maintain the **Traefik + NGINX** two-tier design (`docker-compose.dozzle.yml`).
3. **Production Kubernetes Deployment:**
   Deploy **`ingress-nginx`** using `helm upgrade --install` with `infrastructure/kubernetes/ingress-controller/ingress-nginx-values.yaml`.
4. **Standalone Local Testing:**
   Use **Caddy** via `docker compose --profile caddy up -d` when Traefik is not desired.
