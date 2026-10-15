# AGENTS.md — apps/tax-service

Scope: `apps/tax-service` only. Root rules still apply — start there.

## What this service is

Node.js (TypeScript strict) + Fastify 5 tax calculation microservice: jurisdiction-aware tax calculation, configurable versioned tax rules, customer exemptions, auditable quotes, historical calculation snapshots, and replaceable external provider adapter pattern. Port 8017.

**Source-of-truth split (never mix these):**

- MySQL (`tax_db`, Drizzle ORM) — authoritative for jurisdictions (`tax_jurisdictions`), product tax categories (`tax_categories`), versioned rules (`tax_rules`), customer exemptions (`tax_exemptions`), calculation snapshots (`tax_calculations`, `tax_calculation_lines`), and provider audit logs (`tax_provider_logs`).
- Redis (`@repo/redis`, `tax:v1:*`) — rule cache with TTL and rate limits.
- Kafka — asynchronously consumes `order.created`, `product.tax-category.updated`, and `tax.rules.updated`; publishes `tax.calculation.completed`, `tax.calculation.failed`, `tax.rules.updated`, `tax.calculation.adjusted` using the repository envelope `producer.send(topic, { value: payload })`.

## Architecture & Layers

- `src/server.ts` & `src/index.ts` — Fastify 5 HTTP application with CORS, request logging, security headers, and graceful teardown.
- `src/db/` — Drizzle ORM MySQL schema (`schema.ts`), MySQL connection pool (`connection.ts`), migrations (`migrate.ts`), and seed script (`seed.ts`).
- `src/services/` — Business logic:
  - `calculator.ts`: Decimal-safe arithmetic engine (`decimal.js`, zero JS float errors), inclusive/exclusive tax, priority stacking, and proportional return adjustments.
  - `tax.service.ts`: Jurisdiction resolution, category resolution, exemption verification, rule versioning, calculation snapshot persistence, and return quotes.
- `src/adapters/` — Tax Provider Adapter Pattern:
  - `tax-provider.interface.ts`: `ITaxProviderAdapter` contract.
  - `standard-tax-engine.adapter.ts`: Default local jurisdiction rule engine adapter.
  - `external-tax-provider.adapter.ts`: External tax compliance adapter (Avalara/TaxJar shape) with credential redaction and latency logging.
  - `provider-factory.ts`: Resolves provider based on configuration.
- `src/repositories/` — Isolated data access layer:
  - `jurisdiction.repository.ts`: CRUD and hierarchical jurisdiction matching (country, state/region, municipality).
  - `tax-category.repository.ts`: Category lookup and creation.
  - `tax-rule.repository.ts`: Versioned rules matching and activation.
  - `tax-exemption.repository.ts`: Customer certificate and type exemptions.
  - `tax-calculation.repository.ts`: Calculation snapshot persistence and retrieval.
- `src/controllers/` & `src/routes/`:
  - `tax.controller.ts` / `tax.routes.ts`: Public and checkout endpoints.
  - `admin-tax.controller.ts` / `admin-tax.routes.ts`: Admin rule mutations and activations.
  - `health.routes.ts`: Liveness and readiness probes (`/health`, `/ready`).
- `src/middleware/` — Constant-time internal secret comparison (`safeTimingCompare`) and Clerk admin auth.
- `src/events/` — Kafka producers (`producers/tax.producer.ts`) and consumers (`consumers/order.consumer.ts`, `consumers/product.consumer.ts`).

## Routes & Endpoints

- Customer / Public / Checkout:
  - `POST /api/v1/tax/quote` — calculates estimated tax quote for cart/order items without persistent snapshot.
  - `POST /api/v1/tax/calculate` — calculates authoritative tax and persists an immutable calculation snapshot for an order.
  - `GET /api/v1/tax/calculations/:calculationId` — retrieves historical calculation snapshot.
  - `POST /api/v1/tax/returns/quote` — calculates proportional tax adjustments for returned order lines.
  - `GET /api/v1/tax/jurisdictions` — list active tax jurisdictions.
  - `GET /api/v1/tax/categories` — list product tax categories.
- Admin (`requireAdminOrInternal` required):
  - `GET /api/v1/admin/tax/overview` — executive KPI dashboard metrics (rules, jurisdictions, exemptions, snapshots, collected tax).
  - `GET /api/v1/admin/tax/rules` — list all tax rules (filter by jurisdiction, category, active status).
  - `POST /api/v1/admin/tax/rules` — creates a new versioned tax rule.
  - `PATCH /api/v1/admin/tax/rules/:ruleId` — updates tax rule conditions or rates.
  - `DELETE /api/v1/admin/tax/rules/:ruleId` — deletes a tax rule.
  - `POST /api/v1/admin/tax/rules/:ruleId/activate` — activates a tax rule.
  - `POST /api/v1/admin/tax/rules/:ruleId/deactivate` — deactivates a tax rule.
  - `POST /api/v1/admin/tax/jurisdictions` — adds a new tax jurisdiction.
  - `POST /api/v1/admin/tax/categories` — adds a new product tax category.
  - `GET /api/v1/admin/tax/exemptions` — lists customer tax exemption certificates.
  - `POST /api/v1/admin/tax/exemptions` — grants a customer tax exemption certificate.
  - `GET /api/v1/admin/tax/calculations` — lists historical calculation audit logs.
- Health:
  - `GET /health` — liveness probe.
  - `GET /ready` — readiness probe (MySQL + Redis connectivity).

## Testing & Quality

- Test runner: `tests/tax-service.test.ts` via standalone `tsx`.
- Run tests: `pnpm --filter tax-service test`.
- Type-check: `pnpm --filter tax-service check-types`.
