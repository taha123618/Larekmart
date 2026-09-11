# `@repo/typescript-config`

Shared TypeScript compiler configurations (`tsconfig.json` bases) across the Larekmart monorepo.

## Available Configurations

- `@repo/typescript-config/base.json`: Strict TypeScript base for Node.js services, utilities, and backend workspaces.
- `@repo/typescript-config/nextjs.json`: Extended configuration for Next.js 15 App Router applications.
- `@repo/typescript-config/react-library.json`: Configuration for React UI component packages.

## Usage

In a workspace `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"]
}
```
