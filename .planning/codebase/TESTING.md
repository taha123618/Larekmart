---
last_mapped_commit: 056473daac295e995dc34f9bdb56d4d180211c77
last_mapped_at: 2026-10-02
---
# Testing Patterns

**Analysis Date:** 2026-10-02

## Test Framework

**Runner:**
- Polyglot Test Architecture orchestrated via Turborepo (`turbo.json` -> `pnpm test`):
  - Node.js TSX Runner (`npx tsx tests/index.test.ts`) used across Node services (`order-service`, `user-service`, `cart-service`, `shipping-service`, `media-service`, `@repo/types`)
  - Go Test (`go test ./...`) for `apps/notification-service`
  - Pytest (`uv run pytest tests/ -q`) for `apps/recommendation-service`

**Assertion Library:**
- Node.js built-in `node:assert` and `node:test` for Node services
- Go standard `testing` package
- Pytest assertion mechanisms

**Run Commands:**

```bash
pnpm test                         # Run all test suites across monorepo
pnpm --filter user-service test   # Run specific microservice tests
pnpm --filter @repo/types test    # Validate contract schemas
pnpm check-types                  # Strict TypeScript validation across all packages
```

## Test File Organization

**Location:**
- Microservices place test suites in dedicated `tests/` directories at the workspace root:
  - `apps/user-service/tests/index.test.ts`
  - `apps/media-service/tests/index.test.ts`
  - `apps/shipping-service/tests/index.test.ts`
  - `apps/order-service/tests/index.test.ts`
  - `apps/cart-service/tests/index.test.ts`
  - `packages/types/tests/index.test.ts`

**Naming:**
- Node test files: `tests/index.test.ts` or `tests/*.test.ts`
- Go test files: `*_test.go`
- Python test files: `tests/test_*.py`

## Test Structure

**Suite Organization (Node services):**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("User Profile & Address API", () => {
  test("should validate postal code format", async () => {
    const valid = validatePostalCode("12345");
    assert.equal(valid, true);
  });
});
```

**Patterns:**
- Standalone self-contained test execution using `npx tsx`.
- In-memory mock databases or transaction rollbacks for database tests.

## Mocking

**What to Mock:**
- External third-party payment gateways (Stripe API)
- Outbound SMTP connections (SendGrid / Resend)
- Carrier rate calculation APIs (FedEx, DHL)

**What NOT to Mock:**
- Internal Zod schema validation rules in `@repo/types`
- Pure utility calculation logic (tax, shipping, cart totals)

## Fixtures and Factories

**Test Data:**
- Seed data fixtures located in `packages/product-db/prisma/seed.ts`
- Mock event payloads generated conforming to schemas in `@repo/types`

## Coverage

**Requirements:**
- Critical business logic (pricing, cart checkout calculations, event serialization, address formatting) must have regression tests.
- CI pipeline executes `pnpm test` and `pnpm check-types` on all pull requests.

## Test Types

**Unit Tests:**
- Validate entity schemas, Zod validators, token decoders, and business math.
- Location: `packages/types/tests/`, `apps/*/tests/`.

**Integration Tests:**
- Test HTTP endpoint routing, parameter validation, database models, and error responses.
- Location: `apps/*/tests/index.test.ts`.

**Contract & Event Tests:**
- Verify Kafka event schemas match producer and consumer expectations.

---

*Testing analysis: 2026-10-02*
