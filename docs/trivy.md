# Trivy Security & Vulnerability Scanning Guide

This guide explains how to run, verify, and use **Trivy** in the Larekmart microservices platform for container vulnerability scanning, SBOM generation, misconfiguration auditing, and secret leak detection.

---

## 1. Environment Configuration

The following variables are configured in `.env` and `.env.example`:

```env
# Trivy Security Scanner Configuration
TRIVY_PORT=4954
TRIVY_TOKEN=MySecureToken123
```

> **Note on Port 4954**: Port `4954` is selected instead of `8080` to avoid port collisions with `api-gateway` and `kafka-ui` (which use port `8080`).

---

## 2. Starting & Stopping the Trivy Server

Trivy runs in server mode via [`docker-compose.security.yml`](./docker-compose.security.yml):

```bash
# Start the Trivy server in the background
pnpm trivy:up
# or: docker compose -f docker-compose.security.yml up -d

# Stop the Trivy server
pnpm trivy:down
# or: docker compose -f docker-compose.security.yml down
```

---

## 3. How to Verify the Trivy Server Is Healthy

You can verify the server by querying its built-in health check endpoint:

```bash
curl -i http://localhost:4954/healthz
```

**Expected Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

ok
```

> **Note on Browser Access**: If you open `http://localhost:4954/` in a web browser, it will return `404 page not found`. This is normal: Trivy Server is an API/RPC backend server, not a browser graphical user interface. Receiving `404` confirms that the server is active and listening on port `4954`.

---

## 4. How to Use the Running Trivy Server

You communicate with the server using the Trivy CLI or Docker client passing `--server http://host.docker.internal:4954` (when running inside Docker) or `--server http://localhost:4954` (from the host) and your token:

### 1. Scan a Docker Image via the Server

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:0.53.0 image \
  --server http://host.docker.internal:4954 \
  --token MySecureToken123 \
  alpine:latest
```

Scan a local Larekmart service image:

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:0.53.0 image \
  --server http://host.docker.internal:4954 \
  --token MySecureToken123 \
  larekmart-product-service:latest
```

---

### 2. Scan the Local Project Directory (Filesystem / Dependencies / Secrets)

```bash
docker run --rm \
  -v $(pwd):/workspace \
  aquasec/trivy:0.53.0 fs \
  --server http://host.docker.internal:4954 \
  --token MySecureToken123 \
  --severity HIGH,CRITICAL \
  /workspace
```

---

### 3. Scan Infrastructure Misconfigurations (Terraform & Kubernetes)

```bash
docker run --rm \
  -v $(pwd):/workspace \
  aquasec/trivy:0.53.0 config \
  --server http://host.docker.internal:4954 \
  --token MySecureToken123 \
  /workspace/infrastructure
```

---

## 5. Direct Standalone Scan (Without Server)

If you wish to run a quick scan without starting the server daemon:

```bash
docker run --rm \
  -v $(pwd):/apps \
  -v larekmart_trivy_cache:/root/.cache/trivy \
  aquasec/trivy:0.53.0 fs /apps
```
