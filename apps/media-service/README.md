# media-service

Media microservice for Larekmart: S3/MinIO-backed object storage, presigned
direct uploads, metadata in PostgreSQL (Drizzle), Redis caching/rate limits,
Kafka lifecycle events, and asynchronous Sharp image processing.

Port: **8013** · Framework: **Hono** · Storage: **S3-compatible (MinIO in dev)**

## Architecture

```
              Client
                │  POST /api/v1/media/uploads
                ▼
        ┌───────────────┐   presigned PUT   ┌──────────────┐
        │ media-service │ ────────────────▶ │   S3/MinIO   │
        │  (Hono :8013) │ ◀──────────────── │  (binaries)  │
        └───────┬───────┘   direct upload   └──────┬───────┘
                │                                  │
   ┌────────────┼────────────┬─────────────┐       │
   ▼            ▼            ▼             ▼       ▼
PostgreSQL    Redis        Kafka      media-worker (Sharp)
 metadata     cache        events      variants: thumbnail/
 (Drizzle)    ratelimit    lifecycle   small/medium/large
```

**Source-of-truth rules** (do not mix):

| System     | Owns                                                          |
| ---------- | ------------------------------------------------------------- | --- | ----- | --------------------------------------------------------- |
| PostgreSQL | media metadata, variants, upload sessions, jobs, event ledger |
| S3 / MinIO | media binaries                                                |     | Redis | cache, rate limits, temporary state — never authoritative |

The resolve endpoint (`POST /api/v1/media/resolve`) is Redis-cached: a batch
key covering the request's ref list serves repeat page views with one GET,
and per-entry keys backfill individual ids. Unresolved media ids are
negative-cached with the same TTL so unprocessed uploads don't hammer
PostgreSQL. Invalidations fire on every transition that changes a resolved
URL (READY, quarantine, soft delete/restore, owner reassignment, purge);
batch entries are TTL-bounded and self-heal. Only unauthenticated batches
are cached — PRIVATE visibility is actor-dependent.
| Kafka | lifecycle event propagation |
| Sharp | image transformation (worker only) |

## Technology stack

Node.js 20 · TypeScript (strict) · Hono 4 · Drizzle ORM + drizzle-kit ·
PostgreSQL · Redis (`@repo/redis`) · Kafka (`@repo/kafka`, kafkajs) · Zod ·
AWS SDK S3 + presigner (works with MinIO and any S3-compatible provider) ·
Sharp · Prometheus-style metrics (`@repo/monitoring`) · Docker.

## Directory structure

```
apps/media-service/
├── src/
│   ├── app.ts                 # Hono app: CORS, security headers, health, routes
│   ├── server.ts              # API entrypoint
│   ├── config/env.ts          # Zod-validated environment
│   ├── routes/                # media.ts, uploads.ts, admin.ts (thin handlers)
│   ├── services/              # media, upload, processing, admin (business logic)
│   ├── db/                    # Drizzle client, schema/, repositories/, migrate.ts
│   ├── storage/               # ObjectStorage interface, s3.provider, minio.provider
│   ├── processing/            # image.processor (Sharp), validation
│   ├── messaging/             # publishers/, consumers/ (idempotent)
│   ├── cache/redis via utils/ # @repo/redis handle
│   ├── workers/               # processing.worker, cleanup.worker
│   ├── schemas/               # upload.schema (MIME, magic bytes, limits)
│   ├── middleware/            # auth (Clerk), error-handler, rate-limit
│   ├── observability/         # metrics (Prometheus), tracing context
│   └── errors/                # domain error hierarchy
├── drizzle/migrations/        # generated SQL migrations
├── tests/media-service.test.ts
├── drizzle.config.ts
├── Dockerfile
└── .env.example
```

## API

| Method   | Path                                      | Auth           | Purpose                                                     |
| -------- | ----------------------------------------- | -------------- | ----------------------------------------------------------- |
| `POST`   | `/api/v1/media/uploads`                   | user           | Validate + create media + presigned upload URL              |
| `POST`   | `/api/v1/media/:mediaId/complete`         | user (owner)   | Verify object, publish `media.uploaded`, enqueue processing |
| `GET`    | `/api/v1/media/:mediaId`                  | public/private | Metadata (PRIVATE requires owner/admin)                     |
| `GET`    | `/api/v1/media/:mediaId/url`              | user           | Dynamic public/presigned URL (`?variant=`)                  |
| `GET`    | `/api/v1/media/owner/:ownerType/:ownerId` | public/private | List media for an owner                                     |
| `DELETE` | `/api/v1/media/:mediaId`                  | user (owner)   | Soft delete (recovery window before purge)                  |
| `GET`    | `/api/v1/admin/media`                     | admin          | List media across owners                                    |
| `POST`   | `/api/v1/admin/media/:mediaId/reprocess`  | admin          | Re-enqueue variant generation                               |
| `POST`   | `/api/v1/admin/media/:mediaId/restore`    | admin          | Undo soft delete                                            |
| `DELETE` | `/api/v1/admin/media/:mediaId/purge`      | admin          | Permanent binary + metadata removal                         |
| `GET`    | `/health` `/health/live` `/health/ready`  | public         | Health probes                                               |
| `GET`    | `/metrics`                                | public         | Prometheus metrics                                          |

### Upload flow

1. `POST /api/v1/media/uploads` with `{ ownerType, ownerId, filename, contentType, size }`.
2. Response contains `mediaId`, `uploadUrl` (presigned PUT), `objectKey`, `expiresAt`.
3. Client uploads the file **directly** to S3/MinIO with the presigned URL.
4. `POST /api/v1/media/:mediaId/complete` — the service verifies existence,
   size, and type, transitions `PENDING → UPLOADING → PROCESSING`, publishes
   `media.uploaded`, and enqueues the Sharp job.
5. The worker generates configured variants, writes them to storage, marks the
   media `READY`, and publishes `media.processing_completed`.

Binaries never traverse the API service.

## Media lifecycle

`PENDING → UPLOADING → PROCESSING → READY`, with `FAILED` on processing
errors, `QUARANTINED` when content is not the declared type, and `DELETED`
as the soft-delete tombstone before purge.

## Environment variables

See `.env.example`. Key groups: Postgres (`DATABASE_URL`), Redis
(`REDIS_URL`, `REDIS_KEY_PREFIX`), Kafka (`KAFKA_BROKERS`, `KAFKA_GROUP_ID`),
S3 (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`), limits
(`MEDIA_UPLOAD_LIMITS` JSON, `MEDIA_MAX_FILE_SIZE`), processing
(`MEDIA_VARIANTS=name:edge,…`), auth (`CLERK_*`),
`MEDIA_DEV_AUTH_BYPASS` (development only; startup fails in production).

## Local development

```bash
# 1. Infrastructure: PostgreSQL (creates media_db), Redis, Kafka, MinIO + bucket
docker compose up -d postgres redis kafka minio minio-init

# 2. Environment
cp apps/media-service/.env.example apps/media-service/.env

# 3. Migrations (Drizzle)
pnpm --filter media-service db:migrate

# 4. API + workers (separate terminals — they scale independently)
pnpm --filter media-service dev
pnpm --filter media-service dev:worker
pnpm --filter media-service dev:cleanup
```

MinIO console: http://localhost:9001 (minioadmin/minioadmin).

### Testing

```bash
pnpm --filter media-service test    # offline unit tests (no infra needed)
```

Covers object-key generation/traversal safety, filename sanitization, MIME
detection by magic bytes, spoofed extensions, per-category size limits,
cross-owner authorization, private-media visibility, URL strategy, and the
lifecycle enums.

### Docker

The service builds with the monorepo turbo-prune pattern, runs as non-root
(`honojs`), and starts with `node dist/server.js`. `media-worker` and
`media-cleanup` reuse the same image with different commands — scale them
independently of the API (`docker compose up -d --scale media-worker=4`).

## Security notes

- Clerk everywhere; `userId` always derived from verified session claims.
- Ownership is checked on every mutation; PRIVATE media requires owner/admin.
- Client Content-Type/filename/extension are never proof of file type — the
  object is verified by magic bytes before/while processing.
- Object keys are service-generated; user input never enters key paths.
- Presigned URLs are short-lived and generated dynamically, never stored.
- Rate limits (Redis-backed, configurable) protect upload, complete, URL,
  delete, and admin endpoints; they fail open if Redis is down.

## Troubleshooting

- **`/health/ready` says not_ready** — check Postgres, Redis, and MinIO
  (`docker compose ps`); storage connectivity is part of readiness.
- **Media stuck in PROCESSING** — the worker claims jobs from
  `media_processing_jobs`; confirm `media-worker` is running. Crashed jobs
  are requeued when their `started_at` goes stale.
- **Resolve returns stale/null URLs after processing finished** — a cached
  negative entry or batch entry hasn't expired yet (bounded by
  `MEDIA_CACHE_TTL_SECONDS`, default 60s); it self-heals on the next read.
- **`media.uploaded` published but no variants** — worker not running or
  Sharp failed; check `media_processing_jobs.error` and worker logs.
- **Kafka unavailable** — the API starts degraded: uploads work, lifecycle
  events are logged as failures and consumers retry on reconnect.
