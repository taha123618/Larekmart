# Testing Guide

This document outlines the testing strategy, current verification mechanisms, and standards for introducing automated tests to Larekmart.

## Current Testing Reality

The repository currently does not have an automated test runner configured (no Jest, Vitest, or Playwright suite). Verification relies on:

1. **Strict TypeScript Compilation**:
   ```bash
   pnpm check-types
   ```
2. **Production Build Validation**:
   ```bash
   pnpm build
   ```
3. **Static Linting**:
   ```bash
   pnpm lint
   ```
4. **Manual & Integration Verification**:
   Testing end-to-end user flows against local services, Kafka UI (`http://localhost:8080`), PostgreSQL, and MongoDB.

## Testing Strategy & Standards

When writing automated tests in Larekmart, adhere to the following architecture:

### 1. Recommended Test Runner

- **Vitest** is the standard test runner for this monorepo due to native ESM support, rapid execution, and TypeScript integration.

### 2. Unit Testing Layer

- **Location**: Co-located with implementation files (`foo.test.ts` next to `foo.ts`).
- **Scope**:
  - Zod validation schemas in `@repo/types`.
  - Utility functions and calculation logic.
  - State reducers and store actions (e.g. Zustand cart store).
  - Kafka message serialization and deserialization helpers.
- **Mocking**: External services (Stripe API, Clerk SDK, live Kafka brokers, database connections) MUST be mocked in unit tests.

### 3. Integration Testing Layer

- Test HTTP route handlers and Kafka message processing using in-memory or containerized dependencies.
- Keep integration tests isolated and opt-in so they do not break standard offline `pnpm check-types`.

### 4. End-to-End (E2E) Testing Layer

- **Playwright** is recommended for cross-browser testing of customer checkout and admin dashboard flows.

## Adding Tests to a Workspace

To introduce tests to a workspace:

1. Add `vitest` as a devDependency in the target workspace:
   ```bash
   pnpm add -D vitest --filter <workspace>
   ```
2. Add a test script in `apps/<workspace>/package.json`:
   ```json
   "scripts": {
     "test": "vitest run"
   }
   ```
3. Register the `test` task in `turbo.json`:
   ```json
   "tasks": {
     "test": {
       "dependsOn": ["^build"]
     }
   }
   ```
