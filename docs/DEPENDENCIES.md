# Package dependencies

The monorepo is a directed graph with a single rule: **dependencies point outward from
applications to packages, never the other way.** Packages never import application code,
and applications never import each other.

## Graph

```
apps/client ─┐
             ├─▶ @repo/types ─┬─▶ @repo/product-db ─▶ @prisma/client ─▶ PostgreSQL
apps/admin ──┘                └─▶ @repo/order-db   ─▶ mongoose      ─▶ MongoDB

apps/product-service ─┬─▶ @repo/product-db
                      ├─▶ @repo/kafka ─▶ kafkajs
                      └─▶ @repo/types

apps/order-service ───┬─▶ @repo/order-db
                      ├─▶ @repo/kafka
                      └─▶ @repo/types

apps/payment-service ─┬─▶ @repo/kafka
                      ├─▶ @repo/types
                      └─▶ stripe

apps/auth-service ────┬─▶ @repo/kafka
                      └─▶ @clerk/express

apps/email-service ───┬─▶ @repo/kafka
                      └─▶ @repo/types

apps/analytic-service ┬─▶ @repo/kafka
                      ├─▶ @repo/types
                      └─▶ pg

apps/admin, apps/client ─▶ @repo/eslint-config, @repo/typescript-config
all workspaces          ─▶ @repo/typescript-config, @repo/monitoring
```

## Package roles

| Package                   | Kind         | Depends on                                  | Public surface                                                                  |
| ------------------------- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------- |
| **`@repo/monitoring`**    | leaf utility | —                                           | `createLogger`, `createHealthRegistry`, `createMetricsRegistry`, `measureAsync` |
| `@repo/kafka`             | leaf utility | `kafkajs`                                   | `createKafkaClient`, `createProducer`, `createConsumer`                         |
| `@repo/types`             | contract     | `@repo/product-db`, `@repo/order-db`, `zod` | API/domain types, Zod schemas, constants                                        |
| `@repo/product-db`        | persistence  | `@prisma/client`                            | `prisma` client + generated Prisma types                                        |
| `@repo/order-db`          | persistence  | `mongoose`                                  | `Order`, `OrderStatus`, `OrderSchemaType`, `connectOrderDB`                     |
| `@repo/eslint-config`     | config       | eslint plugins                              | `base`, `next-js`, `react-internal`                                             |
| `@repo/typescript-config` | config       | —                                           | `base.json`, `nextjs.json`, `react-library.json`                                |

## Boundary rules

1. **No app → app imports.** Shared behavior belongs in a package. This keeps the two
   frontends and the services independently deployable.
2. **No package → app imports.** Packages must not know their consumers.
3. **Contracts in `@repo/types`.** If two workspaces need the same type or schema, it
   lives here — not copied into each.
4. **Persistence is owned by its db package.** Only `product-service` imports
   `@repo/product-db` at runtime; only `order-service` imports `@repo/order-db`.
   `@repo/types` is the deliberate exception: it imports **types** from both so it can
   re-export domain shapes. Keep that coupling type-only — do not introduce runtime
   imports or cycles there.
5. **Internal references use `workspace:*`.**
6. **Kafka is the only service-to-service channel.** No HTTP client between backends.

## Watch-outs

- `@repo/types` sits on top of both database packages. Adding runtime logic there that
  pulls in Prisma/Mongoose would drag database clients into frontend bundles. Prefer
  `import type` for the persistence-derived types.
- In several `package.json` files `@repo/types` is listed under `devDependencies` even
  though it is used in application code. When adding a genuinely runtime dependency,
  declare it in `dependencies` so bundlers and deployments resolve it correctly.
- `@repo/types`' `package.json` has a stale `"main": "src/index/ts"` field; consumers
  resolve through the `exports` map instead. Don't rely on `main`.
- Removing or renaming a package export is a breaking change for every consumer. Grep
  the repo for the symbol before changing the surface.

## Checking the graph

There is no automated boundary linter. Verify manually:

```bash
# who imports a package
grep -rn "@repo/types" apps packages --include=*.ts --include=*.tsx -l
```

`pnpm check-types` will catch missing exports and type breaks across dependents, and
Turborepo orders `check-types`/`build` by dependency (`dependsOn: ["^build"]`).
