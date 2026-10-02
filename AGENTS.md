# AGENTS.md — Larekmart monorepo (root)

This file is the entry point for **every** AI coding agent working in this repository.
It describes the whole system, the rules that always apply, and where to load more
specific instructions. Keep it accurate: if you change architecture, update this file
and the relevant scoped `AGENTS.md`.

## 1. What this is

**Larekmart** is a microservices e-commerce platform for clothing. It is a
**pnpm + Turborepo monorepo** with two Next.js frontends, 15 backend services, and
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
   - `apps/admin/AGENTS.md`, `apps/client/AGENTS.md`
   - `apps/<service>/AGENTS.md` for `auth-service`, `order-service`, `payment-service`, `email-service`, `product-service`, `analytic-service`, `notification-service`, `search-service`, `inventory-service`, `recommendation-service`, `cart-service`, `catalog-service`, `shipping-service`, `user-service`, `media-service`
   - `packages/<pkg>/AGENTS.md` for `kafka`, `types`, `monitoring`, `redis`, `opensearch`, `product-db`, `order-db`, `cart-db`, `inventory-db`, `catalog-db`, `shipping-db`, `user-db`, `typescript-config`
3. **Feature skills** — `.agents/skills/<skill>/SKILL.md`, loaded by name when relevant.
   Root skills live in `.agents/skills/`; workspace skills live in `<workspace>/.agents/skills/`.

Cross-editor mirrors of the root rules: `.cursor/rules/*.mdc` (Cursor),
`.github/copilot-instructions.md` (GitHub Copilot), `CLAUDE.md` (Claude Code).
**`AGENTS.md` is the source of truth** — when rules change, update it first.

## 3. AI Agent Execution Lifecycle

Every AI coding agent operating in this repository MUST follow this 3-stage lifecycle:

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
5. **Enforce Security**: Derive `userId` from verified Clerk sessions, never trust client-supplied input, and verify Stripe webhook signatures.
6. **Handle Errors Safely**: Return structured `{ message }` JSON from HTTP services. Catch and log async errors in Kafka handlers to prevent consumer loop crashes.

### After Making Changes

1. **Type-Check**: Run `pnpm check-types` (or `pnpm --filter <workspace> check-types`) across affected packages.
2. **Build**: Run `pnpm build` (or `pnpm --filter <workspace> build`) if a Next.js app or `payment-service` was modified.
3. **Lint**: Run `pnpm lint` if `apps/admin` or `apps/client` were touched.
4. **Format**: Run `pnpm format` on modified files.
5. **Review Diff**: Verify no secrets, `.env` files, or generated Prisma files were staged.
6. **Update Documentation**: Update relevant `README.md`, `AGENTS.md`, or `docs/` files if architecture, contracts, or workflows were changed.

## 4. Repository map

| Workspace                 | Path                          | Runtime                 | Port | Purpose                                                                            |
| ------------------------- | ----------------------------- | ----------------------- | ---- | ---------------------------------------------------------------------------------- |
| `client`                  | `apps/client`                 | Next.js 15 (App Router) | 3002 | Storefront: browse, cart, Stripe checkout, orders                                  |
| `admin`                   | `apps/admin`                  | Next.js 15 (App Router) | 3003 | Admin dashboard: products, categories, users, orders                               |
| `product-service`         | `apps/product-service`        | Express 5               | 8000 | Product + category CRUD (Prisma/Postgres)                                          |
| `order-service`           | `apps/order-service`          | Fastify 5               | 8001 | Orders (Mongoose/MongoDB) + analytics                                              |
| `payment-service`         | `apps/payment-service`        | Hono                    | 8002 | Stripe checkout sessions, webhooks, Stripe product sync                            |
| `auth-service`            | `apps/auth-service`           | Express 5               | 8003 | Admin user management proxying Clerk                                               |
| `email-service`           | `apps/email-service`          | Node worker             | —    | Consumes Kafka events, sends email (no HTTP)                                       |
| `analytic-service`        | `apps/analytic-service`       | Express 5               | 8004 | Consumes Kafka events, aggregates metrics & REST API                               |
| `notification-service`    | `apps/notification-service`   | Go 1.22 (Chi)           | 8005 | Multi-channel notifications, worker pool & WebSockets                              |
| `search-service`          | `apps/search-service`         | Fastify 5               | 8006 | OpenSearch product search, filtering, autocomplete & indexing                      |
| `inventory-service`       | `apps/inventory-service`      | Hono 4                  | 8007 | PostgreSQL stock, reservations, warehouse inventory, and inventory events          |
| `recommendation-service`  | `apps/recommendation-service` | Python 3.12+ (FastAPI)  | 8008 | Collaborative, content, pgvector hybrid recommendation engine & Celery worker      |
| `cart-service`            | `apps/cart-service`           | Express 5               | 8009 | Authoritative MongoDB carts, guest/user merge, pricing estimates & TTL worker      |
| `catalog-service`         | `apps/catalog-service`        | Fastify 5               | 8010 | Read-optimized product discovery, categories, brands, collections & storefront     |
| `shipping-service`        | `apps/shipping-service`       | Koa (Node.js)           | 8011 | Shipment lifecycle, rates, carrier adapters (TCS/Leopards/DHL/FedEx), tracking     |
| `user-service`            | `apps/user-service`           | Fastify 5               | 8012 | Customer profiles, saved addresses, preferences, and account domain                |
| `media-service`           | `apps/media-service`          | Hono 4                  | 8013 | Media uploads, object storage, image variants & lifecycle events                   |
| `@repo/kafka`             | `packages/kafka`              | Library                 | —    | kafkajs wrapper + local Kafka compose                                              |
| `@repo/types`             | `packages/types`              | Library                 | —    | Shared types + Zod schemas (contract package)                                      |
| `@repo/monitoring`        | `packages/monitoring`         | Library                 | —    | Logging, health checks, metrics & telemetry                                        |
| `@repo/opensearch`        | `packages/opensearch`         | Library                 | —    | OpenSearch client factory, product index mappings, query builders, bulk indexing   |
| `@repo/redis`             | `packages/redis`              | Library                 | —    | ioredis client factory, typed cache helpers, namespace invalidation, rate limiter  |
| `@repo/product-db`        | `packages/product-db`         | Library                 | —    | Prisma client + schema (PostgreSQL)                                                |
| `@repo/inventory-db`      | `packages/inventory-db`       | Library                 | —    | Prisma inventory schema, reservations, and stock ledger (PostgreSQL)               |
| `@repo/order-db`          | `packages/order-db`           | Library                 | —    | Mongoose connection + Order model (MongoDB)                                        |
| `@repo/cart-db`           | `packages/cart-db`            | Library                 | —    | Mongoose connection + Cart models (MongoDB)                                        |
| `@repo/catalog-db`        | `packages/catalog-db`         | Library                 | —    | Prisma catalog read-model schema (PostgreSQL) for catalog-service                  |
| `@repo/shipping-db`       | `packages/shipping-db`        | Library                 | —    | Prisma shipping schema, shipments, packages, tracking events & labels (PostgreSQL) |
| `@repo/user-db`           | `packages/user-db`            | Library                 | —    | Prisma user schema, profiles, addresses, preferences & settings (PostgreSQL)       |
| `@repo/eslint-config`     | `packages/eslint-config`      | Config                  | —    | Shared ESLint flat configs                                                         |
| `@repo/typescript-config` | `packages/typescript-config`  | Config                  | —    | Shared tsconfig bases                                                              |

## 5. Golden rules

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
- **Never commit secrets.** Only `.env.example` files are tracked; real `.env*` files
  are gitignored. Read config from environment variables.
- **Never edit generated code.** `packages/product-db/generated/prisma/**` is produced
  by `prisma generate` and is gitignored. Change the schema instead.
- **Match existing conventions** before introducing new libraries. Check whether the
  dependency already exists in the workspace you are editing.
- **Keep changes scoped.** Use Turborepo filters for the workspace you touch; do not
  reformat unrelated files.

## 6. Commands

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
pnpm --filter @repo/product-db db:generate   # prisma generate (required before typecheck)
pnpm --filter @repo/product-db db:migrate    # prisma migrate dev
pnpm --filter @repo/product-db db:deploy     # prisma migrate deploy
pnpm --filter @repo/inventory-db db:generate # generate inventory Prisma client
pnpm --filter @repo/inventory-db db:migrate  # inventory migration in development
pnpm --filter media-service db:migrate       # media-service Drizzle migrations (media_db)

# Docker Ecosystem (Full Orchestration & Infrastructure)
docker compose up -d --build                 # start entire microservices stack (15 apps + backing DBs)
docker compose down                          # stop all containers preserving volumes
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui minio minio-init # backing infra only
# See docs/DOCKER.md for complete operations manual
```

## 7. Engineering conventions

- **TypeScript strict** everywhere: `strict`, `noUncheckedIndexedAccess`,
  `isolatedModules`, `moduleResolution: bundler`, `module: ESNext` (see
  `packages/typescript-config/base.json`). Do not weaken these.
- **ESM packages.** `"type": "module"`; backend source files import local modules
  with an explicit `.js` extension (Node ESM output), even though some paths omit it.
  Follow the extension style of the file you are editing.
- **Type-check before you finish.** Run `pnpm check-types` (or the workspace filter)
  and `pnpm build` for changes that affect a Next.js app or payment-service.
- **Testing strategy.** Eight workspaces ship real test suites run by `pnpm test`
  (Turborepo): `@repo/types`, `user-service`, `cart-service`, `shipping-service`,
  `order-service`, and `media-service` use standalone tsx-run test files under
  `tests/` (follow the file's internal runner convention, e.g.
  `media-service/tests/index.test.ts`); `notification-service` uses `go test ./...`;
  `recommendation-service` uses pytest via `uv`. There is **no Vitest/Jest anywhere** —
  do not introduce a new runner when extending an existing suite. When adding tests,
  follow `docs/TESTING.md`. Note: `tsc` configs typecheck `src/` only — test files are
  not covered by `pnpm check-types`, so keep test code strict-clean by hand (no `any`,
  no casts that hide type mismatches) and typecheck new test files directly with
  `npx tsc --noEmit --strict ...` when hardening them.
- **Logging** is `console.log`/`console.error` today. Keep it structured and sparse.
- **Error handling** at boundaries: services return `{ message }` JSON with correct
  status codes; async Kafka handlers catch and log so a bad message cannot kill the
  consumer loop.

## 8. Definition of done

Before considering a task complete:

- [ ] The change respects the dependency boundaries and the workspace's `AGENTS.md`.
- [ ] Shared types/schemas were added to `@repo/types` if they cross a boundary.
- [ ] `pnpm check-types` passes for affected workspaces.
- [ ] `pnpm build` passes if a Next.js app or `payment-service` changed.
- [ ] `pnpm lint` passes if `admin` or `client` changed.
- [ ] `pnpm test` passes for affected workspaces with test suites.
- [ ] New env vars were added to the relevant `.env.example` (never a real `.env`).
- [ ] Docs/AGENTS.md updated when architecture, contracts, or workflows changed.

<!-- GSD Configuration — managed by gsd-core installer -->
# Instructions for GSD

- Use the gsd-core skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command (or any deliverable it triggers: feature, bug fix, tests, docs, etc.), ALWAYS: (1) offer the user the next step by prompting via `ask_user`; repeat this feedback loop until the user explicitly indicates they are done.
<!-- /GSD Configuration -->
