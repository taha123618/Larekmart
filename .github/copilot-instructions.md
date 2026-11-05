# GitHub Copilot instructions — Larekmart

Canonical rules live in [`AGENTS.md`](../AGENTS.md); scoped rules live in
`apps/*/AGENTS.md` and `packages/*/AGENTS.md`. Prefer those files when they conflict
with this summary.

## Repository Architecture

pnpm 9 + Turborepo monorepo for **Larekmart**, a production-grade microservices e-commerce platform for market place like: amazon,daraz,ALiexpress,ALibaba and other . Two
Next.js apps (`client` :3002, `admin` :3003), 25 backend services (`product-service` :8000,
`order-service` :8001, `payment-service` :8002, `auth-service` :8003, `analytic-service` :8004,
`notification-service` :8005, `search-service` :8006, `inventory-service` :8007,
`recommendation-service` :8008, `cart-service` :8009, `catalog-service` :8010, `shipping-service` :8011,
`user-service` :8012, `media-service` :8013, `review-service` :8014, `wishlist-service` :8015,
`promotion-service` :8016, `tax-service` :8017, `return-service` :8018, `pricing-service` :8019,
`vendor-service` :8020, `seller-service` :8021, `commission-service` :8022, `payout-service` :8023, `email-service` worker), `api-gateway` (:8080), and shared packages (`@repo/kafka`, `@repo/types`,
`@repo/monitoring`, `@repo/redis`, `@repo/opensearch`, `@repo/product-db`, `@repo/inventory-db`,
`@repo/order-db`, `@repo/cart-db`, `@repo/catalog-db`, `@repo/shipping-db`, `@repo/user-db`, `@repo/vendor-db`, `@repo/eslint-config`, `@repo/typescript-config`).

## AI Agent Lifecycle

### 1. Before Making Changes

- Understand architecture boundaries (`docs/ARCHITECTURE.md`, `docs/DEPENDENCIES.md`).
- Search for reusable contracts in `@repo/types` (do not duplicate Zod schemas or types).
- Identify which workspaces are in scope.

### 2. While Making Changes

- Use `pnpm` and `pnpm --filter <workspace>`, never npm/yarn.
- Maintain dependency direction: apps → packages; never import app code across apps.
- Integrate backend services **only** through Kafka via `@repo/kafka`, publishing
  `{ value: payload }` and reading `message.value` in handlers.
- Use Clerk for authentication; guard mutating routes with `shouldBeUser`/`shouldBeAdmin`.
- Never use `CLERK_SECRET_KEY` as an HMAC key. Verify direct Bearer tokens with
  `CLERK_JWT_KEY` (RS256) or an explicit `CLERK_JWT_HMAC_KEY` test fixture, and enforce
  `exp`/`nbf`. Development identity bypasses must be explicit opt-in env flags, never
  implied by a missing `NODE_ENV`.
- Keep trust boundaries intact: strip client identity headers at the gateway, never let the
  internal secret grant admin to a proxied user, and never key rate limits on
  client-supplied headers. `TRUST_PROXY` must match the real proxy hop count.
- Read config from environment variables; document new keys in the workspace `.env.example`.
- Preserve TypeScript strictness (`noUncheckedIndexedAccess`, `isolatedModules`).
- Return structured `{ message }` errors in HTTP services; catch errors in Kafka handlers.

### 3. Mandatory Feature Service Delivery Standard (The 6 Pillars)

Whenever building, modifying, expanding, or integrating any feature service (e.g. `chat-service`, `support-service`, `fraud-service`, `payout-service`, etc.), you must strictly follow all 6 pillars:

1. **Pillar 1 — Front-End Delivery (`apps/admin/*`, `apps/client/*`)**: Deliver full UI coverage across both applications: Customer Storefront (`apps/client`) and Admin Management Dashboard (`apps/admin`) with typed client services, responsive layouts, action dialogs, and design-system compliance.
2. **Pillar 2 — Cross-Service & Gateway Integration (`apps/*` all services)**: Wire reverse proxying, rate-limiting, and circuit breakers in `api-gateway`; establish asynchronous Kafka event streams with transactional outbox and DLQ isolation; connect domain relationships without cross-service HTTP calls.
3. **Pillar 3 — Documentation, Skills, Manifests & Configuration Updates (`*.md`, skills, `*.yml`)**: Update architecture docs (`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/EVENT-DRIVEN-ARCHITECTURE.md`), deployment manifests (`docker-compose.yml`, Kubernetes Kustomize, Prometheus, GitHub workflows), and agent skills across all mirror folders.
4. **Pillar 4 — Deep Project Analysis & Comprehensive Testing (Unit & Integration)**: Conduct deep architectural analysis before and after changes; write comprehensive tsx/jest unit and integration test suites; enforce 100% test pass rate with zero TypeScript compile errors.
5. **Pillar 5 — Security Audit & Zero-Trust Hardening**: Remediate OWASP API Top 10 vulnerabilities; strip untrusted headers at the gateway; verify identity via verified Clerk Bearer tokens; enforce constant-time secret comparison (`crypto.timingSafeEqual`); prevent user-to-admin privilege escalation; redact internal notes and private data.
6. **Pillar 6 — Global README.md & Root Architecture Sync**: Keep `README.md` system topology, port mappings, and service documentation synchronized with all codebase changes.

### 4. After Making Changes

- Run `pnpm check-types` across affected workspaces.
- Run `pnpm build` for Next.js apps (`admin`, `client`) and `payment-service`.
- Run `pnpm lint` for `admin` and `client`.
- Update relevant `AGENTS.md` and `docs/` files when contracts, architecture, or behavior change.
- When touching resilience, update the Chaos Mesh manifests in `infrastructure/chaos/`
  (including the parallel `flash-sale-mixed-traffic.yaml` order-plane + replica-lag drill)
  and keep `infrastructure/chaos/README.md` and the chaos plan in sync.

## Never

- Commit secrets or `.env` files, or edit `packages/product-db/generated/**`.
- Add direct HTTP calls between backend services.
- Weaken shared tsconfig/eslint configs or add `any` to bypass type errors.
- Claim tests pass without running verification — follow workspace test runner conventions (`docs/TESTING.md`).

---

# AI Editor Rules

These rules apply to every AI editor and coding agent working in this repository (Claude Code, Cursor, Copilot, Windsurf, and similar tools). Read them before taking any action, and follow them for the whole session.

## 1. Core Principle

Act only within the scope of what the user has asked. When a rule here conflicts with a request that is unclear, stop and ask. Never assume permission.

## 2. Git Safety (Strict)

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

### How permission works

- Permission is **specific and one-time**. "Commit this" does not mean "commit and push."
- Permission does **not** carry over to later tasks or later messages.
- Silence, a vague approval ("looks good"), or a task that merely implies a commit is **not** permission.
- If a git action seems necessary, **stop, explain why, and ask**. Then wait for a clear "yes."

### What you may do freely (read-only)

- `git status`, `git diff`, `git log`, `git show`, `git blame`
- Reading files and inspecting the current branch name

If a read-only command fails or the repository is in an unexpected state, report it. Do not try to fix it with write commands.

## 3. File and Code Changes

- Change only the files needed for the task. Do not refactor, rename, reformat, or reorganise unrelated code.
- Do not delete files, folders, or large blocks of code without asking first.
- Do not overwrite uncommitted work. Check `git status` before large edits and tell the user if there are unrelated changes.
- Never edit lock files, build output, generated files, or `.env` files unless asked.
- Do not install, upgrade, or remove dependencies without permission.
- Do not run database migrations, seeders, or any command that changes data without permission.

## 4. Secrets and Privacy

- Never read, print, log, or commit secrets, API keys, tokens, or credentials.
- Never copy secrets into code, comments, tests, or examples. Use placeholders such as `YOUR_API_KEY`.
- Do not send repository content to external services unless the user asks you to.

## 5. Commands and Environment

- Prefer read-only and reversible commands. Explain any command that could modify, delete, or deploy something before you run it, and get approval.
- Never run destructive commands (`rm -rf`, `DROP TABLE`, force operations) without explicit permission.
- Do not deploy, publish, or release anything without permission.
- Do not use `sudo` or change system-level settings.

## 6. Communication Style

- Write in clear, plain, modern English. Use short sentences and the active voice.
- Be direct. Lead with the result or the question, then give the detail.
- Do not use filler, flattery, or unnecessary apologies.
- Say what you did, what you did not do, and what you need from the user.
- If you are unsure, say so and ask. Never guess and present it as fact.
- Do not claim a task is finished, or that tests passed, unless you actually ran and checked it.

## 7. Code Quality

- Follow the project's existing style, structure, naming, and conventions. Match what is already there.
- Write simple, readable, well-typed code. Prefer clarity over cleverness.
- Handle errors explicitly. Do not silently swallow them.
- Add or update tests when behaviour changes, if the project has tests.
- Write comments only where the reason is not obvious from the code. Explain _why_, not _what_.
- Do not leave debug statements, dead code, or unresolved placeholders behind.

## 8. Working Process

1. **Understand** the request. Ask if anything is unclear.
2. **Plan** briefly for non-trivial changes, and share the plan before large edits.
3. **Make** the smallest change that solves the problem.
4. **Verify** by running relevant checks (tests, type checks, linting) when allowed.
5. **Report** what changed, which files were touched, and what the user should review.
6. **Stop.** Leave committing, branching, pushing, and merging to the user unless they ask you to do it.

## 9. When in Doubt

Stop and ask. A short question costs far less than an unwanted commit, a wrong branch, or lost work.

<!-- GSD Configuration — managed by gsd-core installer -->

# Instructions for GSD

- Use the gsd-core skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command (or any deliverable it triggers: feature, bug fix, tests, docs, etc.), ALWAYS: (1) offer the user the next step by prompting via `ask_user`; repeat this feedback loop until the user explicitly indicates they are done.
<!-- /GSD Configuration -->
