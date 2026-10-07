# Traefik, Dozzle, Caddy & Nginx Edge Routing Guide

This guide describes how **Traefik**, **Dozzle**, **Nginx**, and **Caddy** are configured and integrated into the Larekmart monorepo using the unified `larekmart-network` bridge.

---

## 1. Architecture Overview

```
                                      Internet / Client Request
                                                  │
                                                  ▼
                                 ┌─────────────────────────────────┐
                                 │       Traefik Edge Router       │
                                 │   Ports: 80 (HTTP) / 443 (HTTPS)│
                                 │   Dashboard: http://localhost:8088│
                                 └────────────────┬────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
                 ▼                                ▼                                ▼
  ┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
  │   Nginx Reverse Proxy &      │ │      Caddy HTTP/3 Proxy      │ │   Larekmart API Gateway &    │
  │   Dozzle Live Log Viewer     │ │     (Port 8086 / app.*)      │ │   Microservices              │
  │   (Port 8085 / logs.*)       │ │                              │ │   (Port 8080 / api.*)        │
  └──────────────┬───────────────┘ └──────────────┬───────────────┘ └──────────────┬───────────────┘
                 │                                │                                │
                 └────────────────────────────────┴────────────────────────────────┘
                                                  │
                                                  ▼
                                     ┌─────────────────────────┐
                                     │    larekmart-network    │
                                     │ (Unified Docker Bridge) │
                                     └─────────────────────────┘
```

---

## 2. Service Summary & Endpoints

| Service | File | Host Port | Routing Rule | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Traefik** | `docker-compose.traefik.yml` | `80`, `443`, `8088` | `Host("traefik.localhost")` | Edge router, automatic Let's Encrypt TLS, dynamic container discovery |
| **Dozzle** | `docker-compose.dozzle.yml` | `8888` (direct) | `Host("dozzle.localhost")` | Real-time lightweight Docker container log viewer via `/var/run/docker.sock` |
| **Nginx** | `docker-compose.dozzle.yml` | `8085` | `Host("logs.localhost")` | Reverse proxy fronting Dozzle with 100M upload limit and WebSocket streaming |
| **Caddy** | `docker-compose.caddy.yml` | `8086` | `Host("app.localhost")` | Modern HTTP/2 & HTTP/3 reverse proxy routing to `api-gateway` |

---

## 3. Quick Start Commands

### Start All Stacks (via root compose)
```bash
docker compose -f docker-compose.yml up -d
```
*(Automatically includes core microservices, databases, observability, security, rootprint, traefik, dozzle/nginx, and caddy).*

### Start Stacks Individually

```bash
# Traefik Edge Router
pnpm traefik:up     # or: docker compose -f docker-compose.traefik.yml up -d
pnpm traefik:down

# Dozzle & Nginx Live Log Viewer
pnpm dozzle:up      # or: docker compose -f docker-compose.dozzle.yml up -d
pnpm dozzle:down

# Caddy Reverse Proxy
pnpm caddy:up       # or: docker compose -f docker-compose.caddy.yml up -d
pnpm caddy:down
```

---

## 4. How Services Join `larekmart-network`

Every stack declares the same network configuration:
```yaml
networks:
  larekmart-network:
    name: larekmart-network
    driver: bridge
    attachable: true
```

* **Traefik** uses `--providers.docker.network=larekmart-network` to automatically route incoming traffic to any container on the network that defines `traefik.enable=true` labels.
* **Dozzle** streams container logs directly from Docker engine via `/var/run/docker.sock:ro`.
* **Nginx** forwards traffic to `http://dozzle:8888` with WebSockets enabled (`proxy_set_header Upgrade $http_upgrade`).
* **Caddy** forwards `/api/*` and general traffic to `api-gateway:8080`.
