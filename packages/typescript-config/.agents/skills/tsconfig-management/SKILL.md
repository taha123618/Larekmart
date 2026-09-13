---
name: tsconfig-management
description: Use when modifying shared TypeScript compiler options, target versions, or path mappings in packages/typescript-config.
---

# TypeScript Configuration Management

Guidance for maintaining `@repo/typescript-config`.

## 1. Configurations

- `base.json`: Base options (`target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`).
- `nextjs.json`: Next.js 15 options including JSX transform and Next.js compiler plugin.
- `react-library.json`: Shared React library settings.

## 2. Invariants

- Never disable `strict` or `noUncheckedIndexedAccess`.
- Ensure settings remain compatible with Turborepo task hashing and parallel execution.

## 3. Verification

```bash
pnpm check-types # validates all 21 workspaces
```
