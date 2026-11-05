# AGENTS.md — Larekmart monorepo (root)

This file is the entry point for **every** AI coding agent working in this repository.
It describes the whole system, the rules that always apply, and where to load more
specific instructions. Keep it accurate: if you change architecture, update this file
and the relevant scoped `AGENTS.md`.

## 1. What this is

**Larekmart** is a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other . It is a
**pnpm + Turborepo monorepo** with two Next.js frontends, 26 backend services, and
shared internal packages. Cross-service communication is **asynchronous via Kafka**;
there are no service-to-service HTTP calls.

Read `docs/ARCHITECTURE.md` for the full picture and
`docs/EVENT-DRIVEN-ARCHITECTURE.md` for the event contracts.

## 2. Instruction hierarchy (load the narrowest scope)

Instructions are layered. An agent working in `packages/kafka` must not load frontend
rules, and vice versa. Load in this order and stop at the scope you are editing:

```
Root Rules (AGENTS.md)
    ↓
Global Skills (.agents/skills/*)
    ↓
Workspace Rules (apps/*/AGENTS.md, packages/*/AGENTS.md)
    ↓
Workspace Skills (<workspace>/.agents/skills/*)
```

1. **Root (always)** — this file.
2. **Scope** — the `AGENTS.md` in the workspace you are editing:
   - `apps/admin/AGENTS.md`, `apps/client/AGENTS.md`, `apps/api-gateway/AGENTS.md`
   - `apps/<service>/AGENTS.md` for `auth-service`, `order-service`, `payment-service`, `email-service`, `product-service`, `analytic-service`, `notification-service`, `search-service`, `inventory-service`, `recommendation-service`, `cart-service`, `catalog-service`, `shipping-service`, `user-service`, `media-service`, `review-service`, `wishlist-service`, `promotion-service`, `tax-service`, `return-service`, `pricing-service`, `vendor-service`, `seller-service`, `commission-service`, `payout-service`, `fraud-service`, `support-service`, `chat-service`
   - `packages/<pkg>/AGENTS.md` for `kafka`, `types`, `monitoring`, `redis`, `opensearch`, `product-db`, `order-db`, `cart-db`, `inventory-db`, `catalog-db`, `shipping-db`, `user-db`, `vendor-db`, `support-db`, `typescript-config`
3. **Feature skills** — `.agents/skills/<skill>/SKILL.md`, loaded by name when relevant.
   Root skills live in `.agents/skills/`; workspace skills live in `<workspace>/.agents/skills/`.

Cross-editor mirrors of the root rules: `.cursor/rules/*.mdc` (Cursor),
`.github/copilot-instructions.md` (GitHub Copilot), `CLAUDE.md` (Claude Code).
**`AGENTS.md` is the source of truth** — when rules change, update it first.

## 3. AI Editor Rules

These rules apply to every AI editor and coding agent working in this repository (Claude Code, Cursor, Copilot, Windsurf, Antigravity, and similar tools). Read them before taking any action, and follow them for the whole session.

### 1. Core Principle

Act only within the scope of what the user has asked. When a rule here conflicts with a request that is unclear, stop and ask. Never assume permission.

### 2. Git Safety (Strict)

You must **never** perform any of the following actions without the user's explicit permission, given for that specific action in the current conversation:

- **Commit** (`git commit`, including `--amend`)
- **Push** (`git push`, including `--force` and `--force-with-lease`)
- **Merge** (`git merge`, `git pull` that merges, or merging a pull request)
- **Rebase** or **cherry-pick**
- **Create a new branch** (`git branch <name>`, `git checkout -b`, `git switch -c`)
- **Check out or switch branches** (`git checkout`, `git switch`)
- **Reset, revert, or discard changes** (`git reset`, `git restore`, `git clean`, `git stash drop`)
- **Delete branches or tags**
- **Create, edit, or comment on pull requests, issues, or code reviews**

#### How permission works

- Permission is **specific and one-time**. "Commit this" does not mean "commit and push."
- Permission does **not** carry over to later tasks or later messages.
- Silence, a vague approval ("looks good"), or a task that merely implies a commit is **not** permission.
- If a git action seems necessary, **stop, explain why, and ask**. Then wait for a clear "yes."

#### What you may do freely (read-only)

- `git status`, `git diff`, `git log`, `git show`, `git blame`
- Reading files and inspecting the current branch name

If a read-only command fails or the repository is in an unexpected state, report it. Do not try to fix it with write commands.

### 3. File and Code Changes

- Change only the files needed for the task. Do not refactor, rename, reformat, or reorganise unrelated code.
- Do not delete files, folders, or large blocks of code without asking first.
- Do not overwrite uncommitted work. Check `git status` before large edits and tell the user if there are unrelated changes.
- Never edit lock files, build output, generated files, or `.env` files unless asked.
- Do not install, upgrade, or remove dependencies without permission.
- Do not run database migrations, seeders, or any command that changes data without permission.

### 4. Secrets and Privacy

- Never read, print, log, or commit secrets, API keys, tokens, or credentials.
- Never copy secrets into code, comments, tests, or examples. Use placeholders such as `YOUR_API_KEY`.
- Do not send repository content to external services unless the user asks you to.

### 5. Commands and Environment

- Prefer read-only and reversible commands. Explain any command that could modify, delete, or deploy something before you run it, and get approval.
- Never run destructive commands (`rm -rf`, `DROP TABLE`, force operations) without explicit permission.
- Do not deploy, publish, or release anything without permission.
- Do not use `sudo` or change system-level settings.

### 6. Communication Style

- Write in clear, plain, modern English. Use short sentences and the active voice.
- Be direct. Lead with the result or the question, then give the detail.
- Do not use filler, flattery, or unnecessary apologies.
- Say what you did, what you did not do, and what you need from the user.
- If you are unsure, say so and ask. Never guess and present it as fact.
- Do not claim a task is finished, or that tests passed, unless you actually ran and checked it.

### 7. Code Quality

- Follow the project's existing style, structure, naming, and conventions. Match what is already there.
- Write simple, readable, well-typed code. Prefer clarity over cleverness.
- Handle errors explicitly. Do not silently swallow them.
- Add or update tests when behaviour changes, if the project has tests.
- Write comments only where the reason is not obvious from the code. Explain _why_, not _what_.
- Do not leave debug statements, dead code, or unresolved placeholders behind.

### 8. Working Process

1. **Understand** the request. Ask if anything is unclear.
2. **Plan** briefly for non-trivial changes, and share the plan before large edits.
3. **Make** the smallest change that solves the problem.
4. **Verify** by running relevant checks (tests, type checks, linting) when allowed.
5. **Report** what changed, which files were touched, and what the user should review.
6. **Stop.** Leave committing, branching, pushing, and merging to the user unless they ask you to do it.

### 9. When in Doubt

Stop and ask. A short question costs far less than an unwanted commit, a wrong branch, or lost work.

## 4. AI Agent Execution Lifecycle

Every AI coding agent operating in this repository MUST follow this 3-stage lifecycle and the 6 Pillars Feature Service Delivery Standard:

### 4.1 Mandatory Feature Service Delivery Standard (The 6 Pillars)

Whenever building, modifying, expanding, or integrating any feature service (e.g. `chat-service`, `support-service`, `fraud-service`, `payout-service`, `commission-service`, etc.), agents MUST strictly execute all 6 pillars. No feature service work is complete if any pillar is skipped:

1. **Pillar 1 — Front-End Delivery (`apps/admin/*`, `apps/client/*`)**:
   - Deliver full UI coverage across both applications: Customer Storefront (`apps/client`) and Admin Management Dashboard (`apps/admin`).
   - Create typed API client services under `apps/client/src/services/<feature>.service.ts` and `apps/admin/src/services/<feature>.service.ts` routing through API Gateway.
   - Implement responsive, mobile-first pages, dialogs/modals, data tables, filter toolbars, status badges, and action flows adhering to the Larekmart design system (dark/light mode, Tailwind CSS v4, Zustand/React Query state, hydration safety).

2. **Pillar 2 — Cross-Service & Gateway Integration (`apps/*` all services and others)**:
   - Register reverse-proxy routes in `apps/api-gateway` (`public.routes.ts`, `authenticated.routes.ts`, or `admin.routes.ts`) with route prefix mapping, circuit breakers, rate limiting, and identity header sanitization.
   - Establish asynchronous event-driven pipelines via `@repo/kafka` (producers with transactional outbox, consumers with DLQ poison-pill isolation, typed event contracts in `@repo/types`).
   - Wire cross-service domain links and correlations (e.g. linking to Orders, Payments, Returns, Users, Vendors, Sellers, Inventory, Media, Notifications). Backend services must never make direct synchronous HTTP calls to each other.

3. **Pillar 3 — Documentation, Skills, Manifests & Configuration Updates (`*.md`, skills, `*.yml`)**:
   - Update architecture documents, specifications, and data dictionaries (`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/EVENT-DRIVEN-ARCHITECTURE.md`, `docs/DEPENDENCIES.md`, `docs/plans/*`).
   - Update deployment manifests: `docker-compose.yml`, `docker-compose.traefik.yml`, Kubernetes Kustomize manifests (`infrastructure/kubernetes/base/services/*`, configmaps, network policies), Prometheus scraping configurations (`prometheus.yml`), and GitHub CI/CD workflows (`.github/workflows/*`).
   - Update agent skills across all mirror folders (`.agents/skills/*`, `.claude/skills/*`, `.cursor/skills/*`, `.gemini/skills/*`, `.github/skills/*`).

4. **Pillar 4 — Deep Project Analysis & Comprehensive Testing (Unit & Integration)**:
   - Perform deep architectural analysis before and after making code changes.
   - Implement comprehensive standalone tsx/jest test suites under `apps/<service>/tests/` or `packages/<pkg>/tests/`.
   - Test happy paths, edge cases, input validation rejections, role boundaries, and distributed concurrency idempotency.
   - Achieve 100% test pass rate with zero TypeScript compile errors (`pnpm check-types`).

5. **Pillar 5 — Security Audit & Zero-Trust Hardening**:
   - Perform an end-to-end security review against OWASP API Top 10 vulnerabilities.
   - Enforce perimeter security: strip untrusted client identity headers at the API Gateway; verify identity solely from cryptographic Clerk Bearer tokens (fail-closed in production).
   - Enforce constant-time timing-safe comparisons (`crypto.timingSafeEqual`) for internal shared secrets (`x-internal-secret`) and webhook signatures.
   - Strictly decouple gateway transport secrets from administrative end-user privileges (prevent regular proxied users from escalating to admin).
   - Ensure role-based data isolation and confidentiality (e.g. internal staff notes and sensitive data strictly redacted from customer/seller responses).
   - Remediate all discovered vulnerabilities immediately and document findings in security reports.

6. **Pillar 6 — Global README.md & Root Architecture Sync**:
   - Update root `README.md` to document the new feature service, its port, database, Kafka topics, runtime, and integration touchpoints.
   - Keep the system architecture diagram, visual showcase, and monorepo workspace tables in sync.

### 4.2 Standard Lifecycle Stages (Before, While, After)

### Before Making Changes

1. **Understand Architecture & Boundaries**: Review `docs/ARCHITECTURE.md` and `docs/DEPENDENCIES.md`. Determine which application or package owns the functionality.
2. **Inspect Existing Implementations**: Search for existing utilities, patterns, and conventions before creating new ones.
3. **Locate Reusable Contracts**: Check `@repo/types` for existing domain types and Zod schemas. Do not duplicate contracts across apps.
4. **Identify Blast Radius**: Check which workspaces depend on the files you intend to modify.

### While Making Changes

1. **Make Focused, Minimal Edits**: Do not reformat or refactor unrelated files.
2. **Maintain Boundary Isolation**: Never import code from an application into another application or package.
3. **Follow Event Standards**: For Kafka changes, update the producer, all consumers, `@repo/types`, and `docs/EVENT-DRIVEN-ARCHITECTURE.md` together. Always use the `{ value: payload }` envelope and ensure handlers read `message.value`.
4. **Preserve TypeScript Strictness**: Do not use `any` or `@ts-ignore` to silence type errors.
5. **Enforce Security**: Derive `userId` from verified Clerk sessions, strip client-supplied identity/claim headers at the gateway before forwarding, verify direct Bearer tokens cryptographically (failing closed in production), never treat an internal gateway secret as an admin privilege bypass for users, and verify webhook signatures with constant-time comparisons. Never use `CLERK_SECRET_KEY` as an HMAC key: verify Clerk RS256 tokens with `CLERK_JWT_KEY` (or an explicit `CLERK_JWT_HMAC_KEY` test fixture) and enforce `exp`/`nbf`. Development identity bypasses (headers/query params) must be opt-in via explicit env flags and disabled in production. Gateway rate-limit keys must use verified identity or trusted client IP — never a client-supplied header — and `TRUST_PROXY` must match the real proxy topology.
6. **Handle Errors Safely**: Return structured `{ message }` JSON from HTTP services. Catch and log async errors in Kafka handlers to prevent consumer loop crashes.

### After Making Changes

1. **Type-Check**: Run `pnpm check-types` (or `pnpm --filter <workspace> check-types`) across affected packages.
2. **Build**: Run `pnpm build` (or `pnpm --filter <workspace> build`) if a Next.js app or `payment-service` was modified.
3. **Lint**: Run `pnpm lint` if `apps/admin` or `apps/client` were touched.
4. **Format**: Run `pnpm format` on modified files.
5. **Review Diff**: Verify no secrets, `.env` files, or generated Prisma files were staged.
6. **Update Documentation**: Update relevant `README.md`, `AGENTS.md`, or `docs/` files if architecture, contracts, or workflows were changed.

## 5. Repository map

| Workspace                 | Path                          | Runtime                 | Port | Purpose                                                                                                                               |
| ------------------------- | ----------------------------- | ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `client`                  | `apps/client`                 | Next.js 16 (App Router) | 3002 | Storefront: browse, cart, Stripe checkout, orders                                                                                     |
| `admin`                   | `apps/admin`                  | Next.js 15 (App Router) | 3003 | Admin dashboard: products, categories, users, orders                                                                                  |
| `api-gateway`             | `apps/api-gateway`            | Fastify 5               | 8080 | Single entrypoint reverse proxy, auth, rate limiting, and request correlation                                                         |
| `product-service`         | `apps/product-service`        | Express 5               | 8000 | Product + category CRUD (Prisma/Postgres)                                                                                             |
| `order-service`           | `apps/order-service`          | Fastify 5               | 8001 | Orders (Mongoose/MongoDB) + analytics                                                                                                 |
| `payment-service`         | `apps/payment-service`        | Hono                    | 8002 | Stripe checkout sessions, webhooks, Stripe product sync                                                                               |
| `auth-service`            | `apps/auth-service`           | Express 5               | 8003 | Admin user management proxying Clerk                                                                                                  |
| `email-service`           | `apps/email-service`          | Node worker             | —    | Consumes Kafka events, sends email (no HTTP)                                                                                          |
| `analytic-service`        | `apps/analytic-service`       | Go 1.22 (Chi)           | 8004 | Multithreaded Kafka ingestion, pgx.CopyFrom batching, metrics & REST API                                                              |
| `notification-service`    | `apps/notification-service`   | Go 1.22 (Chi)           | 8005 | Multi-channel notifications, worker pool & WebSockets                                                                                 |
| `search-service`          | `apps/search-service`         | Fastify 5               | 8006 | OpenSearch product search, filtering, autocomplete & indexing                                                                         |
| `inventory-service`       | `apps/inventory-service`      | Hono 4                  | 8007 | PostgreSQL stock, reservations, warehouse inventory, and inventory events                                                             |
| `recommendation-service`  | `apps/recommendation-service` | Python 3.12+ (FastAPI)  | 8008 | Collaborative, content, pgvector hybrid recommendation engine & Celery worker                                                         |
| `cart-service`            | `apps/cart-service`           | Express 5               | 8009 | Authoritative MongoDB carts, guest/user merge, pricing estimates & TTL worker                                                         |
| `catalog-service`         | `apps/catalog-service`        | Fastify 5               | 8010 | Read-optimized product discovery, categories, brands, collections & storefront                                                        |
| `shipping-service`        | `apps/shipping-service`       | Koa (Node.js)           | 8011 | Shipment lifecycle, rates, carrier adapters (TCS/Leopards/DHL/FedEx), tracking                                                        |
| `user-service`            | `apps/user-service`           | Fastify 5               | 8012 | Customer profiles, saved addresses, preferences, and account domain                                                                   |
| `media-service`           | `apps/media-service`          | Hono 4                  | 8013 | Media uploads, object storage, image variants & lifecycle events                                                                      |
| `review-service`          | `apps/review-service`         | Fastify 5               | 8014 | Product reviews, ratings, verified purchases, moderation, helpful votes & summaries                                                   |
| `wishlist-service`        | `apps/wishlist-service`       | Fastify 5               | 8015 | Saved products, wishlists, guest-to-user merge, price drops & restock alerts                                                          |
| `promotion-service`       | `apps/promotion-service`      | Hono 4                  | 8016 | Centralized promotion engine: campaigns, coupons, discount eligibility, usage limits, budgets, checkout reservations, and redemptions |
| `tax-service`             | `apps/tax-service`            | Fastify 5               | 8017 | Jurisdiction-aware tax calculation, tax rules, exemptions, auditable quotes, adapter pattern & snapshot verification                  |
| `return-service`          | `apps/return-service`         | Koa 2                   | 8018 | Return & refund lifecycle: eligibility, partial-quantity returns, evidence, inspection, return-shipment tracking, and refund SAGA     |
| `pricing-service`         | `apps/pricing-service`        | Fastify 5               | 8019 | Authoritative merchandise pricing, multi-currency conversion, tiered rules, promotional quote composition & immutable snapshots       |
| `vendor-service`          | `apps/vendor-service`         | NestJS 10 (Fastify)     | 8020 | Legal business entities, merchant onboarding, KYB verification, documents & lifecycle state management                                |
| `seller-service`          | `apps/seller-service`         | Fastify 5               | 8021 | Marketplace storefront configuration, staff & permissions, operational settings, performance snapshots & seller events                |
| `commission-service`      | `apps/commission-service`     | Fastify 5               | 8022 | Marketplace commission plans, rule versioning, percentage/fixed fees, min/max limits & settlement quotes                              |
| `payout-service`          | `apps/payout-service`         | NestJS 11 (Fastify)     | 8023 | Seller payouts, double-entry ledger, settlement batches, reserve holds & provider reconciliation                                      |
| `fraud-service`           | `apps/fraud-service`          | Python 3.12+ (FastAPI)  | 8024 | Real-time risk assessment, velocity abuse, scikit-learn anomaly scoring, promotion abuse & fraud case management                      |
| `support-service`         | `apps/support-service`        | NestJS 11 (Fastify)     | 8025 | Omnichannel support tickets, SLA policies, escalations, agent queues, workload analytics & real-time Socket.IO                        |
| `chat-service`            | `apps/chat-service`           | Fastify 5               | 8026 | Real-time buyer-seller messaging, live customer support conversations, Socket.IO Redis adapter, presence, read receipts & moderation   |
| `@repo/kafka`             | `packages/kafka`              | Library                 | —    | kafkajs wrapper + local Kafka compose                                                                                                 |
| `@repo/types`             | `packages/types`              | Library                 | —    | Shared types + Zod schemas (contract package)                                                                                         |
| `@repo/monitoring`        | `packages/monitoring`         | Library                 | —    | Logging, health checks, metrics & telemetry                                                                                           |
| `@repo/opensearch`        | `packages/opensearch`         | Library                 | —    | OpenSearch client factory, product index mappings, query builders, bulk indexing                                                      |
| `@repo/redis`             | `packages/redis`              | Library                 | —    | ioredis client factory, typed cache helpers, namespace invalidation, rate limiter                                                     |
| `@repo/product-db`        | `packages/product-db`         | Library                 | —    | Prisma client + schema (PostgreSQL)                                                                                                   |
| `@repo/inventory-db`      | `packages/inventory-db`       | Library                 | —    | Prisma inventory schema, reservations, and stock ledger (PostgreSQL)                                                                  |
| `@repo/order-db`          | `packages/order-db`           | Library                 | —    | Mongoose connection + Order model (MongoDB)                                                                                           |
| `@repo/cart-db`           | `packages/cart-db`            | Library                 | —    | Mongoose connection + Cart models (MongoDB)                                                                                           |
| `@repo/catalog-db`        | `packages/catalog-db`         | Library                 | —    | Prisma catalog read-model schema (PostgreSQL) for catalog-service                                                                     |
| `@repo/shipping-db`       | `packages/shipping-db`        | Library                 | —    | Prisma shipping schema, shipments, packages, tracking events & labels (PostgreSQL)                                                    |
| `@repo/user-db`           | `packages/user-db`            | Library                 | —    | Prisma user schema, profiles, addresses, preferences & settings (PostgreSQL)                                                          |
| `@repo/vendor-db`         | `packages/vendor-db`          | Library                 | —    | Prisma vendor schema, business profiles, KYB documents & verification workflow (PostgreSQL)                                           |
| `@repo/support-db`        | `packages/support-db`         | Library                 | —    | Prisma support schema, tickets, messages, assignments, SLA policies & history (PostgreSQL)                                            |
| `@repo/eslint-config`     | `packages/eslint-config`      | Config                  | —    | Shared ESLint flat configs                                                                                                            |
| `@repo/typescript-config` | `packages/typescript-config`  | Config                  | —    | Shared tsconfig bases                                                                                                                 |

## 6. Golden rules

- **Respect boundaries.** Apps depend on packages; packages never depend on apps.
  Never import code from one app into another app. See `docs/DEPENDENCIES.md`.
- **Shared contracts live in `@repo/types`.** Cross-cutting types, Zod schemas, and
  Kafka payload types belong there — not duplicated per app.
- **Kafka is the only integration path between services.** Publish/subscribe through
  `@repo/kafka`; never add direct HTTP calls between backend services.
- **Follow the Kafka envelope convention.** `producer.send(topic, { value: payload })`
  and handlers read `message.value`. See `.agents/skills/root-architecture` and
  `packages/kafka/AGENTS.md`.
- **Authentication is Clerk everywhere.** Never hand-roll auth. Backends gate routes
  with `shouldBeUser` / `shouldBeAdmin`; admin routes require
  `sessionClaims.metadata.role === "admin"`.
- **Perimeter & Zero-Trust Verification.** API Gateway unconditionally strips untrusted
  client headers before forwarding. Downstream microservices must verify `x-internal-secret`
  in constant time and must never grant admin privileges based solely on gateway transport
  secrets when a user request is being proxied.
- **Never commit secrets.** Only `.env.example` files are tracked; real `.env*` files
  are gitignored. Read config from environment variables.
- **Never edit generated code.** `packages/product-db/generated/prisma/**` is produced
  by `prisma generate` and is gitignored. Change the schema instead.
- **Transactional Outbox for Dual Writes.** State mutations that emit Kafka events
  must persist the event to an outbox model within the database transaction to prevent
  silent event loss.
- **Enforce Distributed Idempotency.** State-mutating routes (`POST /orders/cod`, etc.)
  must enforce `Idempotency-Key` headers using `@repo/redis` atomic leases to prevent
  duplicate mutations and transparently replay cached responses.
- **Thundering-Herd Protection (`SingleFlight`).** High-velocity read aggregation routes
  and cache misses must coalesce in-flight promises via `SingleFlightGroup` before querying
  downstream microservices or databases.
- **Distributed Leader Election & Worker Concurrency Isolation.** Background sweepers across
  horizontally scaled microservice pods must acquire single-leader ownership via `DistributedLeaderElector`
  or `withClusterLock` over `@repo/redis` to prevent duplicate Kafka dispatches and redundant
  database cursor scans.
- **Hyperscale Sharding & Read-Replicas.** Projections with high read-to-write ratios (e.g. `catalog-service`)
  route storefront queries to read-replicas (`readPrisma` via PgBouncer port 6432) while write-plane
  transactions persist to primary (`prisma`). To eliminate replication lag anomalies (<50ms WAL latency),
  an atomic 500ms Read-Your-Writes lease is set in Redis (`markReadYourWrites`) upon mutations, forcing edge
  requests from mutating clients to query `prisma` directly and bypass stale Redis caches. PostgreSQL-backed
  write services additionally stamp `x-db-lsn` (`GATEWAY_HEADERS.DB_LSN`, `pg_current_wal_lsn()`) onto successful
  mutation responses; the API Gateway caches it per client session (`markReadYourWritesWithLSN`) so `catalog-service`
  can compare the session LSN against the replica's `pg_last_wal_replay_lsn()` and fail over onto the primary while
  the replica lags. MongoDB-backed services (order, cart) rely on the 500ms time lease only. High-volume MongoDB
  collections enforce horizontal hashed sharding (`{ userId: "hashed" }`) with compound scatter-gather mitigation
  indexes for seller and saga queries. Redis keys enforce `{tenant_id:warehouse_id}` multi-tenant hash tag CRC16 slot pinning.
- **Chaos Engineering & In-Flight Concurrency Bulkheads.** Transactional endpoints (`/checkout`, `/payments`)
  must enforce in-flight concurrency bulkheads and adaptive rate-limiting clamping at the API gateway
  when downstream circuit breakers report degraded health. Multi-database Saga rollbacks must be
  systematically verified with Chaos Mesh failure injections (`infrastructure/chaos`). The mixed-traffic
  drill (`flash-sale-mixed-traffic.yaml`) runs order-plane latency and read-plane replica lag in
  parallel during a flash-sale checkout and asserts both checkout fast-shed and catalog primary
  failover; keep the chaos scenarios, `infrastructure/chaos/README.md`, and the chaos plan in sync.
- **Poison-Pill & DLQ Isolation.** Consumer loops must rely on `@repo/kafka` DLQ routing
  so malformed payloads (`SyntaxError`, `ZodError`) fast-fail to `<topic>.dlq` without stalling
  partition consumption.
- **Asynchronous Cryptographic Event Attestation.** Critical cross-service financial events
  (`payment.successful`) must carry an HMAC-SHA256 attestation token (`createEventAttestation`
  signed with `INTERNAL_SERVICE_SECRET`). Consuming services (`inventory-service`, `order-service`)
  verify attestation locally in `<0.01ms` via `verifyEventAttestation`, completely eliminating
  external API synchronous calls (e.g. Stripe rate limits) from consumer event loops.
- **Saga ACK Resilience & Optimistic Buffering.** Distributed multi-database saga consumers
  (`inventory.stock.sold`, `tax.calculation.completed`) must enforce exponential backoff retries
  and distributed Redis buffering (`early_ack:inv:${ref}`, `early_ack:tax:${ref}`) to reconcile
  out-of-order event arrivals when downstream services ACK before MongoDB order creation completes,
  preventing false-positive cancellation and refund loops.
- **Universal PgBouncer Connection Multiplexing & Statement Cache Suppression.** All PostgreSQL microservices connect through
  PgBouncer on port 6432 (`DATABASE_URL=...:6432/db?schema=public&pgbouncer=true&statement_cache_size=0`), automatically
  normalizing connections via `normalizePrismaUrl` to disable prepared statement caching (`statement_cache_size=0`) in
  transaction pooling mode, eliminating `Prepared statement does not exist (unnamed)` exceptions and protecting PostgreSQL from connection exhaustion.
- **Kafka Partition & Worker Scale Alignment.** Consumer worker pools (e.g. `analytic-service`) must strictly align with broker
  topic partition topographies (`ANALYTICS_WORKER_COUNT <= KAFKA_NUM_PARTITIONS`, default 3). Any worker count exceeding partition
  counts is clamped automatically on startup to prevent idle thread starvation and perpetual consumer group metadata rebalance storms.
- **ClickHouse High-Throughput Micro-Batching.** Streaming analytics writes into ClickHouse must enforce minimum block chunks
  of 10,000+ rows (`ANALYTICS_BATCH_SIZE=10000`, `ANALYTICS_QUEUE_CAPACITY=50000`) or 500ms regulated temporal flush windows, alongside
  `ReplacingMergeTree` settings (`parts_to_delay_insert = 300`, `parts_to_throw_insert = 600`) to eliminate `Too many parts in all data parts in table`
  storage I/O deadlocks during 11.11 flash-sale campaigns.
- **Hybrid Kafka Entity-Keyed Partitioning & Refund Idempotency.** Checkout saga events must
  pass an entity partition key (`options: { key: orderId || sessionId }`) to enforce strict FIFO
  causal ordering per order, while catalog broadcast updates use entropy-salted keys. Saga compensation
  refunds must pass `{ idempotencyKey: 'saga-refund-${orderId}' }` to prevent duplicate customer refunds.
- **Asynchronous Fast-Claim Inventory Engine & SKU-Keyed Micro-Batching.** During high-velocity flash sales,
  `POST /api/v1/inventory/reservations` evaluates Redis Lua script `precheckAndClaim` in <1ms and returns
  `HTTP 202 Accepted` immediately, avoiding PostgreSQL row-lock serialization. The reservation is dispatched
  to Kafka topic `inventory.reservation.requested` keyed by `${productId}:${variantId}`, where a dedicated worker
  consumes in micro-batches (up to 50 items) via `subscribeBatch()` and updates stock in a single atomic SQL
  statement (`decrement: totalGroupQuantity`) with graceful fallback to individual decrements for tight inventory
  and compensation rollback (`ROLLBACK_LUA`) on failure. See `docs/plans/hyperscale-flash-sale-architecture-hardening.md`.
- **High-Throughput Dual-Mode Kafka Consumer (`subscribeBatch`).** For bulk ingestion and coalesced database
  persistence, consumers use `subscribeBatch()` in `@repo/kafka`. It chunk-processes messages in batches,
  triggers auto-heartbeats every 2,000ms to eliminate rebalance storms during long database transactions,
  and routes individual poison-pill items directly to `<topic>.dlq` without stalling the batch.
- **Dynamic Adaptive In-Flight Concurrency Bulkheads.** In `apps/api-gateway`, concurrency bulkhead limits are
  environment-driven (`BULKHEAD_MAX_CHECKOUT_CONCURRENT`, `BULKHEAD_MAX_PAYMENT_CONCURRENT`, `BULKHEAD_MAX_GENERAL_CONCURRENT`).
  The gateway automatically clamps limits by 10x during degraded or tripped circuit breaker states and relaxes back
  to full throughput upon recovery.
- **Zero-Trust Admin Transport Decoupling & Timing Defenses.** Gateway transport secrets (`x-internal-secret`)
  must never grant administrative privileges to proxied user requests (`x-user-role !== "admin"`). All internal
  secret and webhook signature comparisons must enforce constant-time SHA-256 pre-hashing (`safeTimingCompare`)
  to prevent secret length leakage and covert timing channels. Production startup must fail closed if secrets are
  missing or insecure placeholders. See `docs/plans/security-audit-and-remediation-report.md`.
- **Financial Precision & Balanced Double-Entry Ledger Invariants.** Financial engines (`commission-service`, `payout-service`)
  must never use floating-point numbers; all monetary calculations enforce `Decimal.js`. Seller balances are derived
  dynamically from an append-only double-entry journal (`ledger_entries`) with zero-sum multi-leg transaction invariants
  ($\sum \text{Debit} == \sum \text{Credit}$). See `docs/plans/commission-and-payout-architecture-and-testing.md`.
- **Enterprise Fraud, Abuse Prevention & Risk Invariants.** Risk assessments (`fraud-service`) must evaluate multi-workflow risks
  (`PAYMENT`, `ORDER`, `ACCOUNT`, `PROMOTION`, `PAYOUT`, `SELLER`) using deterministic rule logic paired with scikit-learn anomaly
  scoring. Sliding window velocity checks must run over Redis atomic commands, and high-risk alerts (`fraud.risk.detected`)
  must safely trigger order quarantine, escrow freezes, and payout holds downstream. See `docs/plans/fraud-detection-engine-and-risk-scoring-architecture.md`.

- **Match existing conventions** before introducing new libraries. Check whether the
  dependency already exists in the workspace you are editing.
- **Keep changes scoped.** Use Turborepo filters for the workspace you touch; do not
  reformat unrelated files.

## 7. Commands

Run from the repository root. This project uses **pnpm 9** — do not use npm or yarn.

```bash
pnpm run setup                            # full setup (install + env + AI skills sync)
pnpm run install:all                      # install all workspaces
pnpm run env:setup                        # safely initialize all .env files
pnpm run skills:sync                      # sync .agents/skills to .cursor, .claude, .gemini
pnpm dev                                  # run every dev task (turbo, persistent)
pnpm --filter admin dev                   # single app
pnpm --filter product-service dev         # single service
pnpm build                                # build all (turbo; only Next apps + payment-service build)
pnpm check-types                          # tsc --noEmit across workspaces
pnpm lint                                 # eslint (admin + client only)
pnpm format                               # prettier write (**/*.{ts,tsx,md,js,json})

# Databases
pnpm db:generate                          # generate all Prisma & Drizzle clients
pnpm db:migrate                           # sequential topological dev migrations across all 14 DBs
pnpm db:deploy                            # sequential deterministic deploy migrations (production)
pnpm db:status                            # verify migration status across all databases
pnpm db:seed                              # seed initial product catalog

# Individual Workspace Migrations (Stage-ordered: 1. Foundational -> 2. Operational -> 3. Projected)
pnpm --filter @repo/product-db db:migrate    # Stage 1: Core product entities
pnpm --filter @repo/inventory-db db:migrate  # Stage 1: Stock & warehouses
pnpm --filter @repo/user-db db:migrate       # Stage 1: Users & profiles
pnpm --filter @repo/vendor-db db:migrate     # Stage 1: Vendors & onboarding
pnpm --filter @repo/shipping-db db:migrate   # Stage 2: Shipping & tracking
pnpm --filter media-service db:migrate       # Stage 2: Media uploads (Drizzle)
pnpm --filter pricing-service db:migrate     # Stage 2: Pricing rules (Drizzle)
pnpm --filter promotion-service db:migrate   # Stage 2: Promotions (Drizzle)
pnpm --filter tax-service db:migrate         # Stage 2: Tax calculation (MySQL Drizzle)
pnpm --filter return-service db:migrate      # Stage 2: Returns (MySQL Drizzle)
pnpm --filter @repo/catalog-db db:migrate    # Stage 3: Catalog read projection (after product-db)
pnpm --filter seller-service db:migrate      # Stage 3: Seller storefronts (after vendor-db)
pnpm --filter commission-service db:migrate  # Stage 3: Marketplace commissions (after seller-service)
pnpm --filter payout-service db:migrate      # Stage 3: Seller payouts & ledger (after commission-service)
pnpm --filter review-service db:migrate      # Stage 3: Reviews (after product-db)
pnpm --filter wishlist-service db:migrate    # Stage 3: Wishlists (after product-db)
(cd apps/fraud-service && uv run alembic upgrade head) # Stage 3: Fraud detection & risk rules

# Docker Ecosystem (Full Orchestration & Infrastructure)
docker compose up -d --build                 # start entire microservices stack (26 services + backing DBs)
docker compose down                          # stop all containers preserving volumes
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui mysql # backing infra only
# See docs/DOCKER.md for complete operations manual
```

## 8. Engineering conventions

- **TypeScript strict** everywhere: `strict`, `noUncheckedIndexedAccess`,
  `isolatedModules`, `moduleResolution: bundler`, `module: ESNext` (see
  `packages/typescript-config/base.json`). Do not weaken these.
- **ESM packages.** `"type": "module"`; backend source files import local modules
  with an explicit `.js` extension (Node ESM output), even though some paths omit it.
  Follow the extension style of the file you are editing.
- **Type-check before you finish.** Run `pnpm check-types` (or the workspace filter)
  and `pnpm build` for changes that affect a Next.js app or payment-service.
- **Testing strategy.** Twenty-seven workspaces ship real test suites run by `pnpm test`
  (Turborepo): `@repo/types`, `@repo/kafka`, `@repo/redis`, `api-gateway`, `product-service`, `payment-service`, `auth-service`, `search-service`, `inventory-service`, `catalog-service`, `email-service`, `user-service`, `cart-service`, `shipping-service`,
  `order-service`, `media-service`, `review-service`, `wishlist-service`, `promotion-service`, `tax-service`, `return-service`, `pricing-service`, `vendor-service`, `seller-service`, `commission-service`, and `payout-service` use standalone tsx-run test files under
  `tests/` (follow the file's internal runner convention, e.g.
  `product-service/tests/product-service.test.ts`); `notification-service` and `analytic-service` use `go test ./...`;
  `recommendation-service` and `fraud-service` use pytest via `uv`. There is **no Vitest/Jest anywhere** —
  do not introduce a new runner when extending an existing suite. When adding tests,
  follow `docs/TESTING.md`. Note: `tsc` configs typecheck `src/` only — test files are
  not covered by `pnpm check-types`, so keep test code strict-clean by hand (no `any`,
  no casts that hide type mismatches) and typecheck new test files directly with
  `npx tsc --noEmit --strict ...` when hardening them.
- **Logging** is `console.log`/`console.error` today. Keep it structured and sparse.
- **Error handling** at boundaries: services return `{ message }` JSON with correct
  status codes; async Kafka handlers catch and log so a bad message cannot kill the
  consumer loop.

## 8. Authoritative Architecture & Engineering Plans (`docs/plans/`)

Before designing or modifying cross-service flows, consult the authoritative plans:

- **[Hyperscale Flash-Sale Hardening](docs/plans/hyperscale-flash-sale-architecture-hardening.md)**: 4-pillar 50,000+ RPS resolution (Redis 202 fast-claim, Kafka micro-batching, dynamic bulkhead, PgBouncer :6432).
- **[Distributed Order Saga & Stock Compensation](docs/plans/distributed-order-saga-and-stock-compensation.md)**: Eager stock compensation on Stripe session expiration and payment failure; eliminates phantom Redis stock depletion on cancellations.
- **[OpenSearch Real-Time Bulk Indexing & Micro-Batching](docs/plans/opensearch-real-time-bulk-indexing-pipeline.md)**: Kafka `subscribeBatch` + OpenSearch `_bulk` API processing up to 100 docs per chunk with single cache invalidations.
- **[Multi-Pod WebSocket Desynchronization Hardening](docs/plans/notification-service-redis-pubsub-websocket-sync.md)**: Cross-pod Redis Pub/Sub WebSocket backplane (`notifications:ws:broadcast`) with local userMap filtering, loop suppression, and fail-open resilience.
- **[Comprehensive Security Audit & Remediation](docs/plans/security-audit-and-remediation-report.md)**: Zero-trust perimeter standards, constant-time SHA-256 pre-hashing, and transport secret decoupling.
- **[Commission & Payout Services Architecture](docs/plans/commission-and-payout-architecture-and-testing.md)**: Double-entry ledger, Decimal.js financial precision, and 4-tier commission precedence.
- **[Daraz-Scale Production Readiness](docs/plans/daraz-scale-production-readiness.md)**: Multi-DB dual-ACK Saga, PgBouncer pooling, ring-buffer analytics.
- **[Transactional Outbox Pattern](docs/plans/transactional-outbox-order-service.md)**: Dual-write atomicity and recovery sweepers.
- **[Chaos Engineering & Rate Limiting](docs/plans/chaos-engineering-and-rate-limiting-guardrails.md)**: Chaos Mesh CRDs and parallel mixed-traffic resilience.
- **[Distributed Mutation Idempotency](docs/plans/distributed-mutation-idempotency-key.md)**: IETF `Idempotency-Key` and Redis lease locking.
- Full directory index: [`docs/plans/README.md`](docs/plans/README.md).

## 9. Definition of done

Before considering a task complete:

- [ ] The change respects the dependency boundaries and the workspace's `AGENTS.md`.
- [ ] Shared types/schemas were added to `@repo/types` if they cross a boundary.
- [ ] `pnpm check-types` passes for affected workspaces.
- [ ] `pnpm build` passes if a Next.js app or `payment-service` changed.
- [ ] `pnpm lint` passes if `admin` or `client` changed.
- [ ] `pnpm test` passes for affected workspaces with test suites.
- [ ] New env vars were added to the relevant `.env.example` (never a real `.env`).
- [ ] Docs/AGENTS.md updated when architecture, contracts, or workflows changed.

<!-- super-board:begin v3.1.2 (managed; edits inside are overwritten on upgrade) -->

## Super Board

Board: Backlog · Ready · Building · QA · Review · Blocked · Done. Labels route: `qa` skips Building · `bug`, `feature`, none → built first.

| When                                | Use                                         | NEVER                                            |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| Set up / repair the board           | `/super-board onboard`                      | DON'T hand-edit config mid-run                   |
| Check tickets before a run          | `/super-board lint`                         | NEVER run with AC-less tickets                   |
| Drain the board                     | `/super-board run`                          | NEVER build, test or merge from the orchestrator |
| Board state / halt                  | `/super-board status` · `/super-board stop` |                                                  |
| Build one ticket                    | `/super-build`                              | NEVER build outside the card's worktree          |
| QA a branch, or a live URL alone    | `/super-qa` · `/super-qa <url>`             | NEVER mark QA pass without evidence              |
| Review a PR, merge                  | `/super-review`                             | NEVER `gh pr merge` direct — merge gate only     |
| File bugs from Sentry, PostHog, PRs | `/super-collect`                            | DON'T file without a verifier pass               |
| UI polish                           | `/ui-refine-loop` (human runs it)           | board NEVER runs it                              |
| Diagram / explainer page            | `/visual`                                   |                                                  |
| Commit, pull, push this branch      | `/git-sync`                                 | NEVER force push or rebase shared history        |

| Rule         | Value                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Config       | `.claude/super-board/configs/<slug>.json`                                                                                 |
| Isolation    | 1 card · 1 worktree · 1 branch                                                                                            |
| Merge        | auto for normal changes · money, auth, destructive schema (DROP/TRUNCATE/RENAME) → human · PR > 400 changed lines → human |
| Migrations   | additive → robot migrates allowed DBs only · live DB ALWAYS → 🙋 needs you                                                |
| Blocked card | block-template comment · last line `blocked-by:` · 🙋 = needs you                                                         |
| Secrets      | NEVER read `.env`; key names via `.claude/bin/super-board-env-check.sh`                                                   |

## Writing (super-board)

| Thing            | Format → `.claude/skills/super-board/references/writing-standard.md`                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Commit, PR title | `<emoji> [type] scope: subject` + short bullets · ✨ feat 🐛 fix 🔧 chore ♻️ refactor 🧪 test 📝 docs        |
| PR body          | blocks: status · Problem · Solution · AC + proof · history · Before\|After · Risk — `super-board-pr-body.sh` |
| Ticket           | Problem · Context · Fix · AC · Risk · Blocked by → `docs/agents/issue-tracker.md`                            |
| Comment          | `[role] [label] status` · Did · ✅ Done · ❌ Not done · Next · ≤ 8 lines                                     |
| PR author notes  | file + critical inline review comments: Purpose · What changed · Why it matters → `pr-author-notes.md`       |

- NEVER chain steps with arrows. One step per line, lettered under Where.
- NEVER link screenshots. Embed a raw URL pinned to a sha.
- DON'T repeat file lists in status comments. DON'T write "Not verified" or "Next" in a PR body.
<!-- super-board:end -->
