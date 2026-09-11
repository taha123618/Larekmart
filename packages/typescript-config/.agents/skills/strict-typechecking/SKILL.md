---
name: strict-typechecking
description: Use when tuning compiler flags, module resolution standards, or strict null/index safety in packages/typescript-config.
---

# Strict Type-Checking Standards

Guidance for managing compiler flags across the monorepo.

## 1. Compiler Flags

All workspaces inherit from `@repo/typescript-config/base.json`:

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"isolatedModules": true`
- `"moduleResolution": "bundler"`
- `"module": "ESNext"`

## 2. Shared Bases

- `base.json`: Base configuration for libraries and Node services.
- `nextjs.json`: Extended configuration for Next.js App Router applications (`apps/admin`, `apps/client`).
- `react-library.json`: Configuration for shared React component packages.

## 3. Verification

```bash
pnpm check-types
```
