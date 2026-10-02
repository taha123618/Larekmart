---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---
# Coding Conventions

**Analysis Date:** 2026-10-02

## Naming Patterns

**Files:**
- TypeScript files use `kebab-case.ts` (e.g. `product-service.ts`, `auth-middleware.ts`)
- Component files use `kebab-case.tsx` or `PascalCase.tsx` (e.g. `product-card.tsx`, `Navbar.tsx`)
- Test files use `*.test.ts` or `*.spec.ts`

**Functions & Methods:**
- Functions use `camelCase` (e.g. `createOrder`, `verifyWebhookSignature`, `sendNotification`)
- Route guards and middleware use `shouldBe*` (e.g. `shouldBeUser`, `shouldBeAdmin`)

**Variables & Constants:**
- Variables use `camelCase` (e.g. `cartItemCount`, `activeSession`)
- Global constants and environment variables use `UPPER_SNAKE_CASE` (e.g. `KAFKA_BROKERS`, `DEFAULT_PAGE_SIZE`)

**Types & Interfaces:**
- Types, Interfaces, and Zod schemas use `PascalCase` (e.g. `ProductEntity`, `OrderCreatedEvent`, `CreateProductSchema`)

## Code Style

**Formatting:**
- Prettier 3.6.2 enforcing standard formatting across `**/*.{ts,tsx,md,js,json}`
- Configured via root `.prettierrc` or standard rules (`singleQuote: false`, `semi: true`, `trailingComma: "all"`, `tabWidth: 2`)
- Run commands: `pnpm format` (write) and `pnpm format:check` (verify)

**Linting:**
- ESLint 9 Flat Config (`eslint.config.mjs`) configured in `packages/eslint-config`
- Monorepo rules gate frontend files (`apps/admin`, `apps/client`)
- Strict type checking via TypeScript compiler: `"strict": true`, `"noUncheckedIndexedAccess": true` (`packages/typescript-config/base.json`)

## Import Organization

**Order:**
1. Node built-in modules (`node:path`, `node:crypto`)
2. External third-party packages (`express`, `fastify`, `hono`, `kafkajs`, `stripe`)
3. Internal monorepo workspace packages (`@repo/types`, `@repo/kafka`, `@repo/monitoring`, `@repo/*-db`)
4. Local relative modules (`./utils.js`, `../controllers/order.js`)

**Path Aliases:**
- Monorepo packages use explicit `@repo/*` namespace aliases
- Frontends use `@/*` for relative root imports (`@/components/*`, `@/lib/*`)

## Error Handling

**Patterns:**
- HTTP API boundaries return structured JSON envelopes with standard HTTP status codes:
  ```typescript
  return res.status(400).json({ message: "Invalid payload supplied", error: err.message });
  ```
- Asynchronous Kafka event consumers MUST wrap handler execution in try/catch to avoid unhandled promise rejections that crash the consumer loop:
  ```typescript
  try {
    await processEvent(message.value);
  } catch (error) {
    console.error("Failed to process event:", error);
  }
  ```

## Logging

**Framework:**
- Structured logging via standard output (`console.log`, `console.error`) with correlation context.
- Telemetry & metrics via `@repo/monitoring` (`prom-client`).

**Patterns:**
- Inject `x-correlation-id` header in HTTP requests and forward across Kafka headers.
- Never log passwords, tokens, API keys, or raw credit card data.

## Comments

**When to Comment:**
- Comment on non-obvious architecture boundaries, outbox pattern mechanisms, or Stripe signature verification logic.
- Do not add comments describing self-evident syntax.

**JSDoc/TSDoc:**
- Used on public library functions in `@repo/kafka` and `@repo/monitoring` to specify parameter contracts and return types.

## Function Design

**Size:**
- Single-responsibility functions; route handlers delegate business logic to dedicated service controllers or domain models.

**Parameters:**
- Functions with more than 3 parameters use a typed options object (e.g. `{ topic, payload, correlationId }`).

## Module Design

**Exports:**
- Named exports preferred over default exports in backend services and libraries (`export const createProducer = ...`).
- Default exports used for Next.js page components and route entry points.

---

*Convention analysis: 2026-10-02*
