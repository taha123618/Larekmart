---
name: monorepo-development
description: Use when working with the pnpm/Turborepo toolchain — installing or adding dependencies, creating a workspace, adding a Turbo task, using filters, or debugging build/type-check ordering.
---

# Monorepo development

Tooling: **pnpm 9 workspaces** + **Turborepo 2**. Node ≥ 18.

## Ground rules

- Always use `pnpm`. Installing with npm/yarn corrupts the workspace linking.
- Install from the root. Add a dependency to a specific workspace with a filter.
- Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) and mirrored
  in the root `package.json` `workspaces` field.
- Internal packages are referenced as `workspace:*`.

## Common operations

```bash
pnpm install                                  # install everything
pnpm add <dep> --filter <workspace>           # add a runtime dependency
pnpm add -D <dep> --filter <workspace>        # add a dev dependency
pnpm --filter <workspace> <script>            # run one workspace's script
pnpm --filter <workspace>... <script>         # workspace + its dependencies
turbo run <task> --filter=<workspace>         # run a task through Turbo
```

## Task graph (`turbo.json`)

- `build` — `dependsOn: ["^build"]`, outputs `.next/**`, env `DATABASE_URL`.
- `check-types` / `lint` — `dependsOn` upstream tasks so packages are checked first.
- `dev` — `persistent`, `cache: false`; don't run it as part of another task.
- `db:generate` / `db:migrate` / `db:deploy` — uncached DB tasks (only `@repo/product-db`
  defines them today).

When you add a new script that should participate in cross-workspace ordering, add a
task entry to `turbo.json` rather than relying on manual ordering.

## Adding a workspace

1. Create the directory under `apps/` or `packages/`.
2. Add a `package.json` with a scoped name (`@repo/<name>` for packages) and the scripts
   it supports (`dev`, `build`, `check-types`, `lint`).
3. Extend a shared tsconfig (`@repo/typescript-config/base.json` or `nextjs.json`).
4. If it needs linting, reuse `@repo/eslint-config`.
5. Add its `AGENTS.md` and `README.md`, and register it in the root `AGENTS.md` table.
6. `pnpm install` to link it.

## Adding an internal dependency

Use `workspace:*` (e.g. `"@repo/types": "workspace:*"`). Beware direction: packages must
not depend on apps. Run `pnpm check-types` from the root afterwards — Turbo will check
dependents in the correct order.

## Troubleshooting

- **Types missing for a generated Prisma client:** run
  `pnpm --filter @repo/product-db db:generate`.
- **Script silently skipped by Turbo:** the workspace's `package.json` has no such
  script. Turbo only runs tasks that exist.
- **Stale cache:** `pnpm build --force` (or `turbo run build --force`).
- **Port already in use:** dev servers bind fixed ports — client 3002, admin 3003,
  services 8000–8003.
