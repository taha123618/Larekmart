---
name: eslint-flat-config
description: Use when authoring or extending ESLint v9 flat configurations, composite rulesets, or parser settings in packages/eslint-config.
---

# ESLint Flat Config Workflows

Guidance for managing and maintaining ESLint Flat Config (`eslint.config.js`) across Larekmart workspaces.

## 1. Exported Presets

- `base.js`: Base rules for JavaScript/TypeScript, syntax checks, import resolution, and dead code warnings.
- `next-js.js`: Extends `@next/eslint-plugin-next`, React hooks rules, and App Router linting.
- `react-internal.js`: Configuration for internal React components and UI libraries.

## 2. Flat Config Structure

ESLint 9 uses array-of-objects flat configurations:

```js
import baseConfig from "@repo/eslint-config/base";

export default [
  ...baseConfig,
  {
    rules: {
      // workspace-specific overrides
    },
  },
];
```

## 3. Verification

```bash
pnpm lint
```
