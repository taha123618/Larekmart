# AGENTS.md — packages/typescript-config

Scope: `packages/typescript-config` only. Root rules still apply — start there.

## What this package is

This package provides shared TypeScript configuration bases (`tsconfig.json`) across the Larekmart monorepo.

## Configurations

- `base.json`: Base configuration for Node.js services and shared libraries. Enables `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `module: ESNext`, and `moduleResolution: bundler`.
- `nextjs.json`: Extended configuration tailored for Next.js 15 App Router applications (`apps/client`, `apps/admin`). Includes Next.js plugins and JSX options.
- `react-library.json`: Configuration for React component libraries.

## Rules

- **Do Not Weaken Strictness**: Never disable `strict` or `noUncheckedIndexedAccess`.
- **Global Impact**: Any modification to `base.json` or `nextjs.json` directly affects every workspace.
- **Verification**: Run `pnpm check-types` from the repository root after any edit to verify that all 19 workspaces compile cleanly.
