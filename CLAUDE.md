# CLAUDE.md

The canonical, cross-agent instructions for this repository live in
**[`AGENTS.md`](./AGENTS.md)**. Read that file first; it defines what Larekmart is,
the workspace map, the golden rules, commands, and the instruction hierarchy.

## Claude Code Specifics

- **Instruction Hierarchy:**
  1. Root Rules: [`AGENTS.md`](./AGENTS.md)
  2. Global Skills: `.agents/skills/<skill>/SKILL.md`
  3. Workspace Rules: `apps/*/AGENTS.md`, `packages/*/AGENTS.md`
  4. Workspace Skills: `<workspace>/.agents/skills/<skill>/SKILL.md`
- Load the root `AGENTS.md`, then the `AGENTS.md` of the workspace you are editing.
- Task-focused detail lives in skills. Load one by name when relevant to the current task.
- Do not duplicate rules into this file. If a rule changes, edit `AGENTS.md` (and the
  scoped file it belongs to) so every agent stays in sync.
- This repo is a pnpm 9 + Turborepo monorepo. Use `pnpm`, not npm or yarn, and prefer
  `pnpm --filter <workspace> ...` for scoped commands.
- **Verification:** Run `pnpm check-types` across workspaces, plus `pnpm build` (Next apps,
  payment-service) and `pnpm lint` (admin, client) where they apply. When adding tests,
  follow [`docs/TESTING.md`](./docs/TESTING.md).
- **Architecture & Engineering Plans:** Authoritative specifications, invariants, and verification reports live in [`docs/plans/`](./docs/plans/README.md). Consult them before modifying cross-service flows:
  - Hyperscale Flash-Sale Hardening: [`docs/plans/hyperscale-flash-sale-architecture-hardening.md`](./docs/plans/hyperscale-flash-sale-architecture-hardening.md)
  - Distributed Order Saga & Stock Compensation: [`docs/plans/distributed-order-saga-and-stock-compensation.md`](./docs/plans/distributed-order-saga-and-stock-compensation.md)
  - OpenSearch Real-Time Bulk Indexing: [`docs/plans/opensearch-real-time-bulk-indexing-pipeline.md`](./docs/plans/opensearch-real-time-bulk-indexing-pipeline.md)
  - Multi-Pod WebSocket Desynchronization Hardening: [`docs/plans/notification-service-redis-pubsub-websocket-sync.md`](./docs/plans/notification-service-redis-pubsub-websocket-sync.md)
  - Security Audit & Remediation: [`docs/plans/security-audit-and-remediation-report.md`](./docs/plans/security-audit-and-remediation-report.md)
  - Commission & Payout Architecture: [`docs/plans/commission-and-payout-architecture-and-testing.md`](./docs/plans/commission-and-payout-architecture-and-testing.md)

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
- Write comments only where the reason is not obvious from the code. Explain *why*, not *what*.
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
