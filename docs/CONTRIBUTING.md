# Contributing Guidelines

Guidelines for contributing to the Larekmart monorepo for human engineers and AI coding agents.

## 1. Development Principles

- **Monorepo Discipline**: Use `pnpm` exclusively. Never run `npm` or `yarn`.
- **Architectural Boundaries**: Dependencies point from applications to shared packages (`apps/*` -> `packages/*`). Never import application code into another application or package.
- **Asynchronous Service Communication**: Never introduce direct HTTP calls between backend services; communicate via Kafka topics registered in [`EVENT-DRIVEN-ARCHITECTURE.md`](./EVENT-DRIVEN-ARCHITECTURE.md).
- **Centralized Contracts**: Shared domain types, Kafka payloads, and Zod validation schemas belong in `@repo/types`.

## 2. Daily Workflow

```bash
# 1. Branch from main
git checkout -b feat/your-feature-name

# 2. Start local dependencies
docker compose -f packages/kafka/docker-compose.yml up -d
docker compose -f packages/redis/docker-compose.yml up -d

# 3. Start development servers
pnpm dev

# 4. Scope work to specific workspaces when needed
pnpm --filter client dev
pnpm --filter product-service dev
```

## 3. Pre-Commit Verification Checklist

Before opening a pull request or submitting code changes:

- [ ] **Type Check**: `pnpm check-types` passes across all 13 workspaces.
- [ ] **Build Validation**: `pnpm build` succeeds for Next.js applications and `payment-service`.
- [ ] **Linting**: `pnpm lint` passes for `apps/admin` and `apps/client`.
- [ ] **Formatting**: `pnpm format` has been executed.
- [ ] **No Committed Secrets**: No `.env` files or API keys staged.
- [ ] **Documentation Updated**: Relevant `README.md`, `AGENTS.md`, and `docs/` updated if contracts, architecture, or environment variables changed.

## 4. Commit Message Convention

Follow Conventional Commits:

- `feat(client): add multi-variant color picker`
- `fix(order-service): handle missing customer email in payment webhook`
- `docs(architecture): update Kafka topic contracts`
- `refactor(types): consolidate order schema types`
