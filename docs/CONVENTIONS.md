# Conventions

Match the code around you before introducing a new pattern. These are the conventions
already established in the repository.

## TypeScript

- **Strict mode is non-negotiable.** `packages/typescript-config/base.json` enables
  `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `moduleDetection: force`.
  Do not add `any` to silence errors; narrow types or use `unknown` + validation.
- **ESM:** packages declare `"type": "module"` and use `ESNext` modules. Frontends use
  `moduleResolution: bundler`; services extend `base.json`.
- **Import extensions:** backend files import local modules with an explicit `.js`
  extension (`./middleware/authMiddleware.js`). Some files omit it — follow the style of
  the file you're editing rather than mixing both within one file.
- **Shared types:** cross-workspace types and Zod schemas belong in `@repo/types`.
- **Type-only imports:** use `import type { ... }` when you only need types (especially
  from `@repo/product-db` / `@repo/order-db`, to avoid dragging DB clients into bundles).
- **`as const` tuples** for enumerations (see `colors`, `sizes`, `OrderStatus`).

## Naming

| Thing              | Convention                                    | Example                                                       |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------- |
| Packages           | `@repo/<name>`                                | `@repo/kafka`                                                 |
| Files (components) | PascalCase                                    | `ProductCard.tsx`, `AddProduct.tsx`                           |
| Files (modules)    | kebab/camel, suffix by role                   | `authMiddleware.ts`, `product.controller.ts`, `user.route.ts` |
| React components   | PascalCase                                    | `AppBarChart`                                                 |
| Services           | `<entity>-service`                            | `order-service`                                               |
| Kafka topics       | `<entity>.<past-tense>`                       | `payment.successful`                                          |
| Env vars           | `SCREAMING_SNAKE`, `NEXT_PUBLIC_` for browser | `NEXT_PUBLIC_API_GATEWAY_URL`                                 |

## Backend

- **Framework per service is fixed:** Express (product, auth), Fastify (order), Hono
  (payment), headless worker (email). Don't add a second framework.
- **Structure:** mirror the existing folders — `src/routes`, `src/controllers` (Express),
  `src/middleware`, `src/utils`. Fastify defines routes as a plugin function; Hono mounts
  route modules with `app.route(...)`.
- **Route guards:** apply `shouldBeUser`/`shouldBeAdmin` per route or via a router prefix.
  Mutating routes must be guarded (an existing unguarded `POST /products` is a known
  gap — don't copy it).
- **Persistence:** only through `@repo/product-db` (Prisma) or `@repo/order-db`
  (Mongoose). No ad-hoc clients, no cross-service DB access.
- **Events:** publish via `@repo/kafka` with the `{ value }` envelope; handlers read
  `message.value` and are wrapped so a bad message doesn't kill the loop.
- **Errors:** return `{ message }` JSON with the correct status; Express services have a
  global error handler. Don't leak internals in production responses.
- **Health:** every HTTP service exposes `GET /health` returning `{ status, uptime, timestamp }`.

## Frontend

- **Server Components by default.** Add `"use client"` only for state, effects, event
  handlers, or browser APIs.
- **Data fetching:**
  - Server components call services with `fetch()` using
    `getApiGatewayUrl()` and a Clerk token from `auth().getToken()`.
  - Client components use `useAuth().getToken()` for authenticated requests, and
    TanStack Query (`useQuery`/`useMutation`) in the admin app for interactive data.
- **Forms:** `react-hook-form` + `zodResolver` with schemas imported from `@repo/types`.
- **UI (admin):** shadcn/ui components live in `src/components/ui`; compose with
  `cn()` from `@/lib/utils`; icons from `lucide-react`; toasts via `react-toastify`.
- **State (client):** `zustand` with `persist` for the cart; keep server data on the
  server.
- **Styling:** Tailwind v4 utility classes with the design tokens/CSS variables defined
  in each app's `src/app/globals.css`. Use the existing palette classes
  (`bg-primary-foreground`, `text-gray-500`, etc.) rather than raw hex values.
- **Routing (Next App Router):** route groups for layout separation (`(dashboard)`,
  `(auth)`); dynamic segments in brackets; Clerk catch-all routes
  (`sign-in/[[...sign-in]]`). Read `params`/`searchParams` as promises and `await` them.
- **Images:** always `next/image`; register any remote host in `next.config.ts`.

## Formatting & linting

- **Prettier** is the formatter: `pnpm format` (`**/*.{ts,tsx,md}`). Run it on files you
  touch.
- **ESLint** flat configs come from `@repo/eslint-config`; only `admin` and `client`
  currently define a `lint` script.
- Don't reformat entire files unrelated to your change.

## Comments and dead code

- Prefer self-explanatory code; comment only the non-obvious _why_.
- The repo contains a fair amount of commented-out scaffolding (e.g. temporary mock
  arrays, alternate route implementations). **Don't add more** — delete instead of
  commenting out, and remove legacy blocks when you touch them.
- Do not commit `console.log` debugging noise; keep logs purposeful (startup, errors).

## Git

- Keep commits scoped to one logical change; the history uses conventional-style subjects
  (`feat(create-turbo): ...`).
- Never commit `.env` files, secrets, or `packages/product-db/generated/**`.
