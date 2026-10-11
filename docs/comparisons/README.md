# Infrastructure & Architectural Comparisons

## Larekmart Engineering Decision Matrix

This directory hosts detailed architectural evaluations, trade-off matrices, and production verdicts for core infrastructure choices across the **Larekmart** platform.

---

## Available Comparisons

| Topic / Decision                      | Document                                                                                                                                                    | Focus & Evaluation                                                                                                                                                                                                       |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Full-Stack DevOps & Orchestration** | [DEVOPS-INFRASTRUCTURE-STACK-COMPARISON.md](file:///Users/taha/projects/microservices-ecommerce/docs/comparisons/DEVOPS-INFRASTRUCTURE-STACK-COMPARISON.md) | **Caddy vs. NGINX with Traefik vs. Docker vs. Kubernetes vs. GitHub Actions.** Explains how the 4 infrastructure layers (CI/CD, packaging, orchestration, ingress) interact and what wins at each layer.                 |
| **Ingress & Reverse Proxies**         | [REVERSE-PROXY-INGRESS-COMPARISON.md](file:///Users/taha/projects/microservices-ecommerce/docs/comparisons/REVERSE-PROXY-INGRESS-COMPARISON.md)             | **Caddy vs. NGINX vs. Traefik (and NGINX with Traefik).** Evaluates Docker label dynamic discovery, Kubernetes Ingress Controller performance, TLS automation, and two-tier edge routing.                                |
| **Logging & Telemetry Stacks**        | [OBSERVABILITY-STACK-COMPARISON.md](file:///Users/taha/projects/microservices-ecommerce/docs/comparisons/OBSERVABILITY-STACK-COMPARISON.md)                 | **Dozzle vs. Rootprint vs. CNCF Prometheus / Grafana / Loki / Alertmanager.** Evaluates ephemeral container log tailing, distributed S3 log indexing via Quickwit, metrics correlation, and automated incident alerting. |

---

## Summary Verdicts

### 1. Ingress & Routing Layer

- **Docker Compose (Local/Staging):** **Traefik v3** (dynamic container discovery via labels without reloading config files).
- **Specialized Buffering:** **NGINX sidecar** (fronts Dozzle with 100M payload buffer & SSE upgrade headers).
- **Kubernetes (Production Cloud):** **`ingress-nginx`** (C10K concurrency, HPA autoscaling, and `cert-manager` integration).
- **Standalone Prototyping:** **Caddy** (`--profile caddy`).

### 2. Container Orchestration & CI/CD Layer

- **CI/CD Automation:** **GitHub Actions** for monorepo type-checking, multi-arch Docker image builds, and Trivy CVE scanning.
- **Container Packaging:** **Docker** multi-stage builds with non-root security defaults across all 15 services.
- **Local Dev Orchestration:** **Docker Compose** for instant single-host developer velocity.
- **Production Orchestration:** **Kubernetes (EKS / GKE)** for multi-node high availability, self-healing, and rolling rollouts.

### 3. Observability & Logging Layer

- **Local Dev Workstation:** **Dozzle** (`:8085` / `:8888`) for instant, zero-overhead (~20MB RAM) real-time log streaming.
- **Deep Historical Search:** **Rootprint** (`:8282`) backed by Quickwit on MinIO S3 for low-cost, sub-second log forensics.
- **Production Standard:** **Prometheus + Grafana + Loki + Alertmanager** (`:3001` / `:9090` / `:9093`) for full-spectrum metrics, Kafka queue lag monitoring, and automated on-call alerting.
