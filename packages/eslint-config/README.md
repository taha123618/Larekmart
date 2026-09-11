# `@repo/eslint-config`

Shared ESLint flat configurations across the Larekmart monorepo.

## Configurations

- `@repo/eslint-config/base`: Base ESLint rules for Node.js services and libraries.
- `@repo/eslint-config/next-js`: ESLint configuration for Next.js applications (`apps/admin`, `apps/client`).
- `@repo/eslint-config/react-internal`: ESLint configuration for React component packages.

## Usage

In an application `eslint.config.js`:

```js
import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default nextJsConfig;
```
