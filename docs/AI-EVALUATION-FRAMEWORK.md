# AI Evaluation & Benchmark Framework — Larekmart Monorepo

## 1. Executive Summary & Purpose

The **AI Evaluation & Benchmark Framework** establishes standardized metrics, validation suites, and rigorous scoring rubrics to evaluate AI coding agents operating across the **Larekmart** microservices e-commerce repository.

Because Larekmart is a polyglot, event-driven monorepo (14 workspaces: 2 Next.js apps, 6 backend services, and 6 shared packages), autonomous AI agents must adhere to strict architectural boundaries, asynchronous Kafka conventions, polyglot persistence models, and TypeScript strictness standards.

This document defines how AI coding agents are benchmarked, graded, and continuously aligned with repository standards.

---

## 2. Agent Execution Lifecycle & Governance

Every AI agent operating in Larekmart must execute tasks within the structured 3-stage lifecycle defined in [AGENTS.md](file:///Users/taha/projects/microservices-ecommerce/AGENTS.md):

```
+-------------------------------------------------------------------------------+
| Stage 1: PRE-FLIGHT EVALUATION (Before Making Changes)                        |
| - Inspect docs/ARCHITECTURE.md, docs/DEPENDENCIES.md, and local AGENTS.md     |
| - Verify shared schemas in @repo/types before declaring new models            |
| - Calculate workspace blast radius & identify affected consumers              |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Stage 2: IN-FLIGHT EVALUATION (While Making Changes)                          |
| - Maintain strict workspace boundary isolation (No cross-app imports)         |
| - Enforce Kafka envelope convention: { value: payload } with message.value    |
| - TypeScript strict compliance (No any, no @ts-ignore)                        |
| - Enforce Clerk auth guards & verify webhook signatures (Stripe)              |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Stage 3: POST-FLIGHT EVALUATION (After Making Changes)                        |
| - Run typecheck: pnpm check-types                                             |
| - Run builds: pnpm build (Next.js & payment-service)                          |
| - Run linter & formatter: pnpm lint && pnpm format                            |
| - Sync docs/AGENTS.md & skill configurations                                  |
+-------------------------------------------------------------------------------+
```

---

## 3. Core Evaluation Metrics & Scoring Rubric

Agent performance is measured across 6 foundational pillars on a 0–100 scale:

| Pillar                          | Metric ID     | Evaluation Criteria                                                             | Weight |
| :------------------------------ | :------------ | :------------------------------------------------------------------------------ | :----- |
| **Boundary Isolation**          | `EVAL-BND-01` | 0 cross-app imports; dependencies strictly follow `docs/DEPENDENCIES.md`        | 20%    |
| **Type Safety & Soundness**     | `EVAL-TYP-02` | 0 `any`, 0 `@ts-ignore`, full type-check passing across all 14 workspaces       | 20%    |
| **Event Contract Compliance**   | `EVAL-EVT-03` | Strict `{ value: payload }` envelope, schemas registered in `@repo/types`       | 20%    |
| **Security & Auth Enforcement** | `EVAL-SEC-04` | Clerk session claims verification, Stripe webhook signature validation          | 15%    |
| **Monorepo Hygiene**            | `EVAL-HYG-05` | Zero unformatted files, passing ESLint, no committed secrets or build artifacts | 15%    |
| **Documentation & Skills Sync** | `EVAL-DOC-06` | Scoped `AGENTS.md` and `.agents/skills/` updated when architecture evolves      | 10%    |

### Scoring Matrix

```
Final Score = (EVAL-BND * 0.20) + (EVAL-TYP * 0.20) + (EVAL-EVT * 0.20) + (EVAL-SEC * 0.15) + (EVAL-HYG * 0.15) + (EVAL-DOC * 0.10)
```

- **Grade A (90 - 100)**: **PASS / PRODUCTION READY** — Safe to merge and deploy automatically.
- **Grade B (75 - 89)**: **CONDITIONAL PASS** — Requires minor human review (e.g., missing doc update or lint formatting).
- **Grade C / F (< 75)**: **REJECT / FAIL** — Critical breach (type errors, boundary leak, invalid Kafka envelope, unverified auth).

---

## 4. Standard Benchmark Test Suites

To validate agent capability and prevent regressions, benchmark tasks are executed against isolated test environments:

### Suite A: Microservice Addition / Extension

- **Task**: Add a new endpoint to an existing backend service (e.g., `apps/analytic-service` or `apps/product-service`).
- **Pass Conditions**:
  - Request/response schemas defined in `@repo/types`.
  - HTTP handlers return structured `{ message }` or type-safe JSON.
  - No direct database access across service boundaries.
  - `pnpm check-types` passes with zero errors.

### Suite B: Event Schema Evolution & Kafka Pipeline

- **Task**: Introduce a new Kafka event topic or add optional fields to an existing event.
- **Pass Conditions**:
  - Contract updated in `packages/types/src/index.ts`.
  - Producer uses `producer.send(topic, { value: payload })`.
  - Consumer handlers parse `message.value` and catch async errors safely.
  - `docs/EVENT-DRIVEN-ARCHITECTURE.md` updated in the same commit.

### Suite C: Full-stack Frontend Implementation

- **Task**: Implement a responsive UI feature in `apps/client` or `apps/admin`.
- **Pass Conditions**:
  - Uses Next.js 15 App Router conventions and React Server/Client Components appropriately.
  - No TailwindCSS or arbitrary styling libraries unless requested (uses Vanilla CSS design system).
  - Clean accessibility (ARIA labels, keyboard navigation, semantic HTML).
  - `pnpm lint` and `pnpm --filter <app> build` pass with zero warnings/errors.

### Suite D: Database Schema Migration

- **Task**: Add a new column or table to PostgreSQL via Prisma in `packages/product-db`.
- **Pass Conditions**:
  - Migration script executed or schema properly updated.
  - Generated Prisma client updated via `pnpm --filter @repo/product-db db:generate`.
  - No generated files staged or checked in outside gitignore rules.

### Suite E: Security & Access Control Validation

- **Task**: Protect an administrative or user-specific route.
- **Pass Conditions**:
  - Route guarded by `shouldBeUser` or `shouldBeAdmin`.
  - User ID extracted from verified Clerk session token (`auth.userId`), never trusted from client payload.
  - Stripe webhook handler verifies raw request signature with Stripe SDK.

---

## 5. Automated Verification Pipeline

Agents must run the following automated verification suite before declaring any task complete:

```bash
# 1. Type check across all 14 workspaces in parallel
pnpm check-types

# 2. Build verification for Next.js frontends and bundled backends
pnpm build

# 3. Code formatting & lint verification
pnpm lint
pnpm format

# 4. Multi-agent skill synchronization verification
pnpm run skills:sync
```

---

## 6. Continuous Evaluation & Skill Maintenance

When an agent discovers a new monorepo pattern, workflow optimization, or recurring pitfall:

1. **Capture Knowledge**: Document the finding in the relevant workspace `.agents/skills/<skill-name>/SKILL.md`.
2. **Propagate Customizations**: Run `pnpm run skills:sync` to reflect skills across `.cursor/`, `.claude/`, and `.gemini/`.
3. **Audit Transcripts**: Review AI interaction logs to identify common failures in boundary adherence or type checking.
