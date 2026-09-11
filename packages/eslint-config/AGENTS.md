# AGENTS.md — packages/eslint-config

Scope: `packages/eslint-config` only. Root rules still apply — start there.

## What this package is

This package provides shared ESLint flat configurations (`eslint.config.js`) for the Larekmart monorepo.

## Configurations

- `base.js`: Base ESLint flat configuration for TypeScript and Node.js environments. Includes `@typescript-eslint` recommended rules and Prettier conflict avoidance.
- `next.js`: Extended ESLint configuration for Next.js 15 App Router applications (`apps/admin`, `apps/client`). Integrates `@next/eslint-plugin-next`, React hooks rules, and Core Web Vitals checks.
- `react-internal.js`: Configuration for React components and internal packages.

## Rules

- **ESLint Flat Config**: All configurations use ESLint 9 flat config format (`export default [...]`).
- **Global Impact**: Modifications to these configurations affect linting across all frontend and package workspaces.
- **Verification**: Run `pnpm lint` from the root after making changes to verify that `admin` and `client` pass without lint errors.
