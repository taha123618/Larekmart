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
| ---------- | ------------------------------------------------------------- |
| PostgreSQL | media metadata, variants, upload sessions, jobs, event ledger |
| S3 / MinIO | media binaries                                                |
| Redis      | cache, rate limits, temporary state — never authoritative     |
| Kafka      | lifecycle event propagation                                   |
| Sharp      | image transformation (worker only)                            |

The resolve endpoint (`POST /api/v1/media/resolve`) is Redis-cached: a batch
key covering the request's ref list serves repeat page views with one GET,
and per-entry keys backfill individual ids. Unresolved media ids are
negative-cached with the same TTL so unprocessed uploads don't hammer
PostgreSQL. Invalidations fire on every transition that changes a resolved
URL (READY, quarantine, soft delete/restore, owner reassignment, purge);
batch entries are TTL-bounded and self-heal. Only unauthenticated batches
are cached — PRIVATE visibility is actor-dependent.

## Index strategy

The Drizzle schema (`src/db/schema/*.ts`) indexes every hot query path.
When adding a query, add (or verify) its supporting index in the same change
and document it here. Index definitions are verified by the schema tests
in `tests/integration/repository.test.ts`.

**Active indexes:**

| Index                                  | Table                   | Columns                        | Serves                                                                                                     |
| -------------------------------------- | ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `media_owner_status_idx`               | `media`                 | `owner_type, owner_id, status` | Owner media listings (`GET .../owner/...`, admin list filters)                                             |
| `media_created_at_idx`                 | `media`                 | `created_at`                   | List ordering (`ORDER BY created_at DESC`), abandoned-upload sweeps                                        |
| `media_deleted_at_idx`                 | `media`                 | `deleted_at`                   | Purge sweep (`deleted_at IS NOT NULL AND deleted_at < cutoff`)                                             |
| `media_variants_media_variant_key` (U) | `media_variants`        | `media_id, variant`            | Variant lookups per media; upsert dedupe; FK-driven cascade deletes                                        |
| `media_uploads_media_idx`              | `media_uploads`         | `media_id`                     | Latest-session lookup during upload completion                                                             |
| `media_uploads_status_expires_idx`     | `media_uploads`         | `status, expires_at`           | Expiry sweep (`status = 'PENDING' AND expires_at < now`)                                                   |
| `media_jobs_media_idx`                 | `media_processing_jobs` | `media_id`                     | Job history per media (reprocess, admin views)                                                             |
| `media_jobs_status_created_idx`        | `media_processing_jobs` | `status, created_at`           | **Worker claim** (`WHERE status='PENDING' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED`) + retry requeue |

Key decisions:

- **Worker claim (hot path).** The claim is a single `UPDATE … WHERE id =
(SELECT id … WHERE status = 'PENDING' ORDER BY created_at ASC
FOR UPDATE SKIP LOCKED LIMIT 1)`. The composite `(status, created_at)`
  index turns the inner scan into an index scan over pending rows only, so
  contended claims stay cheap as the queue grows.
- **Cleanup sweeps.** The sweep touches three tables every cycle:
  expired sessions via `(status, expires_at)`, stale `PROCESSING` jobs via
  the jobs `(status, created_at)` index, and purgeable media via
  `deleted_at`. Each predicate leads with an indexed column so sweeps stay
  O(indexed rows), not O(table). Sweeps are bounded (`LIMIT` 50) so a
  backlog drains gradually instead of in one long transaction.
- **Unique constraint as index.** `media_variants_media_variant_key` is a
  unique index: it enforces one row per `(media_id, variant)` and doubles as
  the lookup index for variant reads and upserts.
- **Ordering convention.** Equality columns first (`status`, `owner_type`,
  `owner_id`), then range/order columns (`created_at`, `expires_at`).

## Technology stack

Node.js 20 · TypeScript (strict) · Hono 4 · Drizzle ORM + drizzle-kit ·
PostgreSQL · Redis (`@repo/redis`) · Kafka (`@repo/kafka`, kafkajs) · Zod ·
AWS SDK S3 + presigner (works with MinIO and any S3-compatible provider) ·
Sharp · Prometheus metrics (`@repo/monitoring`) · OpenTelemetry trace headers · Docker.

## Directory structure

```
apps/media-service/
├── src/
│   ├── app.ts                 # Hono app: CORS, security headers, health, routes
│   ├── server.ts              # API entrypoint
│   ├── container.ts           # Dependency injection composition root
│   ├── config/env.ts          # Zod-validated environment
│   ├── routes/                # media.ts, uploads.ts, admin.ts, health.ts (thin routes)
│   ├── handlers/              # media.handler, upload.handler, admin.handler
│   ├── services/              # media, upload, processing, variant, cleanup, admin
│   ├── db/
│   │   ├── client.ts          # PostgreSQL pool + Drizzle client
│   │   ├── migrate.ts         # Runtime migration runner
│   │   ├── schema/            # media, media-variants, media-uploads, processing-jobs, processed-events
│   │   └── repositories/      # media, variant, upload, event repositories
│   ├── storage/               # ObjectStorage interface, s3.provider, minio.provider, object-keys
│   ├── processing/            # image.processor (Sharp), metadata.processor, validation
│   ├── messaging/             # publishers/, consumers/ (product, seller, review, user)
│   ├── cache/                 # media-cache.ts (Redis cache queries & invalidation)
│   ├── utils/                 # kafka.ts (@repo/kafka handle), redis.ts (@repo/redis handle)
│   ├── workers/               # processing.worker.ts, cleanup.worker.ts
│   ├── schemas/               # media.schema, upload.schema, event.schema
│   ├── middleware/            # auth (Clerk), error-handler, rate-limit, request-context
│   ├── observability/         # metrics (Prometheus), tracing context
│   └── errors/                # domain error hierarchy
├── drizzle/migrations/        # generated SQL migrations
├── tests/
│   ├── index.test.ts          # Unified test runner
│   ├── unit/                  # Unit validation & key generation tests
│   ├── storage/               # Storage provider interface & mock tests
│   ├── api/                   # HTTP endpoint tests
│   ├── messaging/             # Kafka publisher & consumer tests
│   ├── workers/               # Image processing & cleanup worker tests
│   └── integration/           # Drizzle schema & invariant tests
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
| `POST`   | `/api/v1/media/resolve`                   | public         | Batch-resolve media ids to URLs (Redis-cached)              |
| `POST`   | `/api/v1/media/:mediaId/variants`         | user (owner)   | Generate or regenerate image variants                       |
| `DELETE` | `/api/v1/media/:mediaId`                  | user (owner)   | Soft delete (recovery window before purge)                  |
| `GET`    | `/api/v1/admin/media`                     | admin          | List media across owners                                    |
| `POST`   | `/api/v1/admin/media/:mediaId/reprocess`  | admin          | Re-enqueue variant generation                               |
| `POST`   | `/api/v1/admin/media/:mediaId/restore`    | admin          | Undo soft delete                                            |
| `DELETE` | `/api/v1/admin/media/:mediaId/purge`      | admin          | Permanent binary + metadata removal                         |
| `GET`    | `/health` `/health/live` `/health/ready`  | public         | Health & readiness probes                                   |
| `GET`    | `/metrics`                                | public         | Prometheus metrics                                          |

### Upload flow

1. `POST /api/v1/media/uploads` with `{ ownerType, ownerId, filename, contentType, size, category?, visibility? }`.
2. Response contains `mediaId`, `uploadUrl` (presigned PUT), `objectKey`, `expiresAt`.
3. Client uploads the file **directly** to S3/MinIO with the presigned URL.
4. `POST /api/v1/media/:mediaId/complete` — verifies existence in storage,
   size against limits, and type, transitions `PENDING → UPLOADING → PROCESSING`, publishes
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
# 1. Infrastructure: PostgreSQL (creates media_db), Redis, Kafka
docker compose up -d postgres redis kafka

# 2. Environment
cp apps/media-service/.env.example apps/media-service/.env

# 3. Migrations (Drizzle)
pnpm --filter media-service db:migrate

# 4. API + workers (separate terminals — they scale independently)
pnpm --filter media-service dev
pnpm --filter media-service dev:worker
pnpm --filter media-service dev:cleanup
```

### Testing

```bash
pnpm --filter media-service test    # runs unit, storage, api, messaging, worker, and lifecycle suites
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
  `media_processing_jobs`; confirm `media-worker` is running. Jobs whose
  `started_at` is older than `MEDIA_WORKER_STALE_JOB_SECONDS` (default 900s)
  are requeued to `PENDING` by the cleanup sweep, so a crashed worker's
  claimed jobs are retried automatically.
- **Resolve returns stale/null URLs after processing finished** — a cached
  negative entry or batch entry hasn't expired yet (bounded by
  `MEDIA_CACHE_TTL_SECONDS`, default 60s); it self-heals on the next read.
- **`media.uploaded` published but no variants** — worker not running or
  Sharp failed; check `media_processing_jobs.error` and worker logs.
- **Kafka unavailable** — the API starts degraded: uploads work, lifecycle
  events are logged as failures and consumers retry on reconnect.
