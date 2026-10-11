# Contributing to Larekmart

Thank you for your interest in contributing to **Larekmart**! We welcome contributions from developers worldwide to help build a world-class, production-grade microservices e-commerce platform.

Please review this guide before submitting code or opening issues.

---

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and constructive in all discussions.

---

## Architectural Principles to Respect

Larekmart enforces strict architectural boundaries:

1. **Package Dependency Direction:** Applications (`apps/*`) depend on shared packages (`packages/*`). Packages **never** import code from applications, and applications **never** import code directly from each other.
2. **Asynchronous Integration:** Cross-service communication is **strictly asynchronous via Kafka**. Backend services never make direct HTTP calls to each other. See [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md).
3. **Shared Contracts:** Domain types, Zod schemas, and Kafka event types belong in `@repo/types`. Do not duplicate types across services.
4. **Package Manager:** Use **pnpm 9** exclusively. Do not use `npm` or `yarn`.

---

## Getting Started

### 1. Prerequisites

- **Node.js**: >= 18.x (Node 20+ LTS recommended)
- **pnpm**: 9.x (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Docker & Docker Compose**: Docker Engine 24+ and Compose v2.20+
- **Go** (>= 1.22) & **Python** (>= 3.12) if modifying `notification-service` or `recommendation-service`.

### 2. Fork and Clone

```bash
git clone https://github.com/<your-username>/Larekmart.git
cd Larekmart
```

### 3. Setup Environment

```bash
# Full automated setup (installs dependencies, generates env files, syncs AI skills)
pnpm run setup
```

### 4. Running the Development Stack

```bash
# Start backing infrastructure (PostgreSQL, Mongo, Redis, Kafka, OpenSearch)
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui

# Generate database clients
pnpm --filter @repo/product-db db:generate
pnpm --filter @repo/inventory-db db:generate

# Start all applications in development mode
pnpm dev

# Or run a single workspace:
pnpm --filter client dev            # Storefront Next.js (port 3002)
pnpm --filter admin dev             # Admin Next.js (port 3003)
pnpm --filter order-service dev     # Order microservice (port 8001)
```

---

## Pre-Commit Verification Checklist

Before creating a pull request, ensure all checks pass:

- [ ] **Typecheck:** `pnpm check-types` passes across all workspaces without `@ts-ignore` or `any`.
- [ ] **Build:** `pnpm build` passes for Next.js applications and `payment-service`.
- [ ] **Lint:** `pnpm lint` passes for `apps/admin` and `apps/client`.
- [ ] **Test:** `pnpm test` passes for modified packages and services.
- [ ] **Format:** `pnpm format` formats all files according to Prettier standards.
- [ ] **Secrets Check:** No `.env` files, API keys, or private tokens are staged.
- [ ] **Documentation:** Relevant markdown files under `docs/` and `README.md` are updated.

---

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>
```

**Common types:**

- `feat`: A new user-facing feature or service endpoint
- `fix`: A bug fix
- `docs`: Documentation updates
- `refactor`: Code reorganization with no functional changes
- `perf`: Performance optimizations
- `test`: Adding or correcting tests
- `chore`: Dependency updates, tooling, or build scripts

**Examples:**

- `feat(client): add dynamic variant color selector`
- `fix(order-service): handle missing customer phone in webhook`
- `docs(docker): update reverse proxy port matrix`

---

## Pull Request Process

1. Create a descriptive branch: `git checkout -b feat/my-new-feature` or `git checkout -b fix/issue-123`.
2. Commit changes with clear, conventional messages.
3. Push to your fork: `git push origin feat/my-new-feature`.
4. Open a Pull Request against the `development` branch of the upstream repository.
5. Fill out the PR template describing the problem, your solution, and how it was tested.
6. Address review comments constructively.
