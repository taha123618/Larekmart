---
name: eslint-rules
description: Use when modifying shared ESLint flat configurations, rulesets, or plugins in packages/eslint-config.
---

# ESLint Flat Config Management

Guidance for maintaining shared linting rules in `@repo/eslint-config`.

## 1. Structure

- `base.js`: Base rules for JavaScript/TypeScript.
- `next.js`: Next.js rules (`@next/next/recommended`, React hooks, React JSX runtime).
- `react-internal.js`: React library linting.

## 2. Best Practices

- Keep rules focused and pragmatic.
- Avoid introducing overly aggressive rules that require silencing comments across existing code.
- Ensure all plugins support the ESLint 9 Flat Config standard.

## 3. Verification

```bash
pnpm lint # runs on admin and client
```
