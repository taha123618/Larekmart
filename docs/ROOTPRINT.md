# Rootprint & MinIO Log Analytics Guide

This guide details how to run, configure, and use **Rootprint** (log analytics and observability platform) backed by **Quickwit** (distributed log search engine) and **MinIO** (S3-compatible object storage) in the Larekmart monorepo.

---

## 1. Stack Architecture

```
                                  ┌─────────────────────────────┐
                                  │      Rootprint Web UI       │
                                  │   http://localhost:8282     │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │         PostgreSQL 17         │                 │        Quickwit v0.9.0        │
        │    (Rootprint Metadata DB)    │                 │  (Fast Distributed Search)   │
        └───────────────────────────────┘                 └──────────────┬────────────────┘
                                                                         │
                                                                         ▼
                                                          ┌───────────────────────────────┐
                                                          │             MinIO             │
                                                          │    (S3-Compatible Storage)    │
                                                          │     API: 9000, UI: 9001       │
                                                          └───────────────────────────────┘
```

---

## 2. Service Endpoints & Credentials

| Service           | Host Port | Internal Container URL  | Default Credentials             | Description                          |
| ----------------- | --------- | ----------------------- | ------------------------------- | ------------------------------------ |
| **Rootprint UI**  | `8282`    | `http://rootprint:8282` | —                               | Web UI and log analytics dashboard   |
| **Quickwit API**  | `7280`    | `http://quickwit:7280`  | —                               | Search & indexing engine             |
| **MinIO S3 API**  | `9000`    | `http://minio:9000`     | `changemeuser` / `changemepass` | S3-compatible storage for index data |
| **MinIO Console** | `9001`    | `http://minio:9001`     | `changemeuser` / `changemepass` | Web management console for buckets   |
| **PostgreSQL 17** | Internal  | `postgres:5432`         | `rootprint` / `rootprint`       | Metadata database                    |

---

## 3. Starting & Stopping the Stack

### Start Stack

```bash
# Using pnpm shortcut
pnpm rootprint:up

# Or using Docker Compose directly
docker compose -f docker-compose.rootprint.yml up -d
```

### View Live Logs

```bash
pnpm rootprint:logs
# or: docker compose -f docker-compose.rootprint.yml logs -f
```

### Stop Stack

```bash
pnpm rootprint:down
# or: docker compose -f docker-compose.rootprint.yml down
```

---

## 4. Automatic S3 Bucket Initialization

When the stack starts, the `minio-init-buckets` helper container automatically provisions the required buckets before Quickwit initializes:

- `quickwit-indexes` — Storage for distributed search indexes
- `quickwit-metastore` — Storage for index metadata
- `media` — Shared bucket for Larekmart's `media-service`

---

## 5. Environment Variables

The stack reads variables from `.env` (with defaults provided in `.env.example`):

```env
# MinIO Object Storage
MINIO_ROOT_USER=changemeuser
MINIO_ROOT_PASSWORD=changemepass

# Rootprint Configuration
ROOTPRINT_ORIGIN=http://localhost:8282
ROOTPRINT_DB_USER=rootprint
ROOTPRINT_DB_PASSWORD=rootprint
ROOTPRINT_DB_NAME=rootprint
QW_S3_ENDPOINT=http://minio:9000
```
