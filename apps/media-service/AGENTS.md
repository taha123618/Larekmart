# AGENTS.md — apps/media-service

Scope: `apps/media-service` only. Root rules still apply — start there.

## What this service is

Hono media microservice: object-storage-backed media uploads, metadata,
image variants, lifecycle events. Port 8013.

**Source-of-truth split (never mix these):**

- PostgreSQL (`media_db`, Drizzle ORM) — metadata, variants, upload
  sessions, processing jobs, processed-event ledger. Binaries are never
  stored in PostgreSQL.
- S3/MinIO — media binaries only, behind the `ObjectStorage` interface.
  MinIO in development, any S3-compatible provider in production. No
  MinIO/AWS-specific business logic.
- Redis — cache, rate limiting, upload-session state, processing locks.
  Never authoritative. Outages degrade performance, never correctness.
- Kafka — lifecycle events (`media.uploaded`, `media.processing_*`,
  `media.deleted`, `media.quarantined`) using the repository envelope
  `producer.send(topic, { value: payload })`.
- Sharp — image processing, exclusively inside the worker processes.

## Processes

- `src/server.ts` — HTTP API (Hono). Thin handlers; logic in services.
- `src/workers/processing.worker.ts` — claims jobs from
  `media_processing_jobs` atomically (`FOR UPDATE SKIP LOCKED`), runs
  Sharp, is independently scalable, no HTTP responsibility.
- `src/workers/cleanup.worker.ts` — expired upload sessions, abandoned
  uploads, purge of soft-deleted media past the retention window.

## Routes & Handlers

- `POST /api/v1/media/uploads` — validate + authorize + metadata row +
  presigned PUT URL. Binaries upload directly to storage; they never
  traverse this API.
- `POST /api/v1/media/:mediaId/complete` — verify object (existence, size,
  type/extension consistency), transition PENDING → UPLOADING → PROCESSING,
  publish `media.uploaded`, enqueue the Sharp job.
- `GET /api/v1/media/:mediaId`, `GET /api/v1/media/:mediaId/url`,
  `GET /api/v1/media/owner/:ownerType/:ownerId`,
  `POST /api/v1/media/resolve`,
  `POST /api/v1/media/:mediaId/variants`,
  `DELETE /api/v1/media/:mediaId` (soft delete).
- Admin: `GET /api/v1/admin/media`, reprocess, restore, purge
  (`shouldBeAdmin`).
- Health: `/health`, `/health/live`, `/health/ready`, `/metrics`.

## Ownership & security

- Generic owner references: `(ownerType, ownerId)`; no cross-database
  foreign keys. Owner types come from `MEDIA_OWNER_TYPES`.
- `createdBy` (verified Clerk id) gates every mutation; admins bypass.
- PRIVATE media is only accessible to owner/admin and always served via
  presigned URLs. URLs are generated dynamically from bucket + object_key,
  never persisted.
- Client Content-Type / filename / extension are never trusted: size is
  re-read from storage, type is verified by magic bytes, images get a
  pixel budget check.
- Object keys are service-generated (`{owners}/{ownerId}/{mediaId}/…`).
  User-controlled paths never enter keys; `ObjectKeySchema` enforces it.

## Kafka

- Publishes after the database transition, failures logged not fatal.
- Consumes `product.deleted`, `seller.deleted`, `review.deleted`,
  `user.deleted`, `category.deleted`, `brand.deleted` → soft-delete
  associated media. Idempotent via the `processed_events` ledger; handlers
  catch errors so one bad message cannot kill the loop.
- Consumes `product.created`, `product.updated`, `user.avatar_uploaded` to
  authoritatively claim media references.

## Verification

```bash
pnpm --filter media-service check-types
pnpm --filter media-service test        # runs unit, storage, api, messaging, worker suites
pnpm --filter media-service build
pnpm --filter media-service db:generate # drizzle-kit generate
```

### Test discipline (hard-learned rules)

- `tsconfig.json` includes `src/**/*` only, so **`check-types` never sees `tests/`**.
  Keep test files strict-clean by hand; when hardening one, typecheck it directly:
  `npx tsc --noEmit --strict --noUncheckedIndexedAccess tests/<file>.ts`.
- **No vacuous assertions.** Never swallow errors to make a rejection test pass
  (`assert.rejects(p).catch(() => undefined)` passes even when the wrong error is
  thrown). Assert on the error `name`/status, and where possible assert the positive
  path too (e.g. the operation succeeds once the blocking condition is fixed).
- **No unsafe cross-type casts.** `x as Record<string, unknown>` against a typed
  interface is a compile error under strict mode and hides contract drift. Prefer
  `satisfies readonly (keyof Interface)[]` over reflection-style checks.
- Fake repos use in-memory maps and boundary casts (`as never` at constructor seams);
  that is accepted convention here. Do not let fakes weaken what the assertions prove.

Live verification needs PostgreSQL (`media_db`), Redis, Kafka, and MinIO:
`docker compose up -d postgres redis kafka minio minio-init` then
`pnpm --filter media-service db:migrate` and `pnpm --filter media-service dev`.
