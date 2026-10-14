# Larekmart Production Edge Routing & Ingress Architecture

This document describes the production reverse-proxy, ingress routing, WebSocket scaling, and network security architecture for the **Larekmart Marketplace Platform**.

---

## 1. Production Architecture Overview

Larekmart uses **Traefik v3** as the single unified Edge Ingress Router for dynamic container discovery, automatic Let's Encrypt TLS termination, security headers, compression, and WebSocket session affinity.

```
                                  Internet / External Clients
                                                │
                                                ▼
                         ┌─────────────────────────────────────────────┐
                         │         Traefik Ingress Controller          │
                         │       Ports: 80 (HTTP) / 443 (HTTPS)        │
                         │    Internal Dashboard: 127.0.0.1:8088       │
                         └──────────────────────┬──────────────────────┘
                                                │
             ┌──────────────────────────────────┼──────────────────────────────────┐
             │                                  │                                  │
             ▼ (shop.localhost)                 ▼ (admin.localhost)                ▼ (api.localhost)
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│     Client Storefront     │      │     Admin Dashboard       │      │        API Gateway        │
│   Next.js 15 (Port 3002)  │      │   Next.js 15 (Port 3003)  │      │     Fastify 5 (Port 8090) │
└───────────────────────────┘      └───────────────────────────┘      └─────────────┬─────────────┘
                                                                                    │
                                               ┌────────────────────────────────────┤
                                               │ (REST & WS Reverse Proxy)          │
                                               ▼                                    ▼
                                  ┌──────────────────────────┐         ┌──────────────────────────┐
                                  │   Notification Service   │         │ 13 Domain Microservices  │
                                  │   Go Chi WS Hub (:8005)  │         │ (Product, Order, Cart,   │
                                  └──────────────────────────┘         │  Catalog, Inventory,     │
                                                                       │  Payment, Search, etc.)  │
                                                                       └──────────────────────────┘
```

---

## 2. Ingress & Proxy Responsibilities Matrix

| Tool           | Role                         | Status               | Architectural Justification                                                                                                                                                                                                                                                                                     |
| :------------- | :--------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Traefik v3** | **Primary Edge Ingress**     | **Active Default**   | Native Docker daemon provider (`/var/run/docker.sock`). Dynamically discovers scaled container replicas via labels (`traefik.*`) with zero config reloads. Automatically manages Let's Encrypt TLS (ACME HTTP-01), security headers, gzip/brotli compression, and WebSocket sticky sessions (`lm_ws_affinity`). |
| **Caddy**      | **Alternative Edge Ingress** | **Optional Profile** | High-performance standalone HTTP/2 & HTTP/3 reverse proxy. Activated via `docker compose --profile caddy up -d` for environments preferring Caddy over Traefik. Kept profile-gated to avoid multi-proxy layering overhead.                                                                                      |
| **Nginx**      | **Removed from Docker**      | **Decommissioned**   | Completely removed from Docker infrastructure to eliminate triple-proxy redundancy. Caddy (`Caddyfile`) handles standalone reverse proxying, while Traefik handles dynamic ingress. Ingress-Nginx is retained exclusively for Kubernetes deployments.                                                           |
| **Dozzle**     | **Container Log Streaming**  | **Active Service**   | Lightweight Go daemon streaming real-time container stdout/stderr. Routed directly via Traefik (`Host("logs.localhost")`) without intermediate proxy overhead.                                                                                                                                                  |

---

## 3. Public vs. Private Infrastructure Boundaries

### Publicly Accessible Services (Via Ingress on Ports 80 & 443)

- **Client Storefront**: `shop.localhost` / `larekmart.localhost` -> `client:3002`
- **Admin Dashboard**: `admin.localhost` -> `admin:3003`
- **API Gateway & WebSockets**: `api.localhost` -> `api-gateway:8090` (handles `/api/*` and `/ws`)
- **Operations & Observability (Local/Admin)**:
  - Traefik Dashboard: `traefik.localhost` / `http://127.0.0.1:8088`
  - Container Logs (Dozzle): `logs.localhost` / `http://127.0.0.1:8888`
  - Grafana Metrics: `monitoring.localhost` / `http://127.0.0.1:3001`
  - Kafka UI: `kafka.localhost` / `http://127.0.0.1:8080`

### Strictly Private Internal Services (Unreachable from Internet)

- **16 Backend Microservices**: `product-service:8000`, `order-service:8001`, `payment-service:8002`, `auth-service:8003`, `analytic-service:8004`, `notification-service:8005`, `search-service:8006`, `inventory-service:8007`, `recommendation-service:8008`, `cart-service:8009`, `catalog-service:8010`, `shipping-service:8011`, `user-service:8012`, `media-service:8013`, `review-service:8014`, `wishlist-service:8015`.
- **Background Workers**: `email-service`, `media-worker`, `media-cleanup`.
- **Datastores & Brokers**: `postgres:5432`, `mongo:27017`, `redis:6379`, `kafka:9092`, `opensearch:9200`.

> **Security Note:** In `docker-compose.yml`, internal services and datastores bind exclusively to loopback (`127.0.0.1`) via `${INTERNAL_SERVICE_BIND_IP:-127.0.0.1}` and `${DB_BIND_IP:-127.0.0.1}`. They are never published to `0.0.0.0`.

---

## 4. WebSocket & Real-Time Connection Scaling

Real-time notifications and live updates use **WebSockets** flowing through:

```
Browser / Client (useWebSocket hook)
         │
         ▼
Traefik Ingress (:80 / :443)
  [Sticky Cookie: lm_ws_affinity]
         │
         ▼
API Gateway (:8090)
  [@fastify/http-proxy on /ws with websocket: true]
         │
         ▼
Notification Service (:8005)
  [Go Chi + gorilla/websocket Hub]
```

### Key Scaling Mechanisms:

1. **Session Affinity (Sticky Cookies)**:
   Traefik pins client WebSocket handshakes using `traefik.http.services.api-gateway-ws-svc.loadbalancer.sticky.cookie=true`. Reconnecting clients stay pinned to the same gateway instance to avoid thrashing.
2. **Buffer Bypass**:
   Proxy buffering and response caching are disabled (`proxy_buffering off` in Nginx, `flush_interval -1` in Caddy, raw duplex stream in Traefik) to guarantee immediate frame delivery.
3. **Cross-Instance Event Distribution**:
   Notification events are published asynchronously across Kafka topics (`notification.events`). Each `notification-service` consumer receives messages from Kafka and broadcasts to connected WebSocket clients.

---

## 5. Horizontal Autoscaling Guide

Stateless services can scale horizontally using Docker Compose without container name collisions:

```bash
# Scale API Gateway to 3 replicas and Client Storefront to 2 replicas:
docker compose up -d --scale api-gateway=3 --scale client=2

# Scale high-traffic microservices:
docker compose up -d --scale product-service=3 --scale catalog-service=3 --scale order-service=2
```

- **Dynamic Upstream Discovery**: Traefik automatically discovers all replica IPs from the Docker socket and registers them in the load balancing pool.
- **Active Health Probing**: Traefik continuously probes `/health/ready` (API Gateway) or `/health` (microservices). If a container fails, traffic drains instantly without downtime.
- **Internal Service Discovery**: Microservices communicating across `larekmart-network` resolve service names (e.g., `http://product-service:8000`) through Docker's internal DNS, which round-robins across all healthy replicas.

---

## 6. Operational Commands

```bash
# Start full production stack (Traefik + Apps + Backing Infra + Observability)
docker compose up -d

# Start only Traefik Edge Router
docker compose -f docker-compose.traefik.yml up -d

# Start live container log viewer (Dozzle)
docker compose -f docker-compose.dozzle.yml up -d

# Start with alternative Caddy Edge Router (instead of Traefik)
docker compose --profile caddy up -d

# Verify full compose syntax & configuration
docker compose config --quiet
```
