---
name: coding-standards
description: Use when writing or refactoring TypeScript/JavaScript, structuring backend handlers, implementing frontend components, or handling errors across Larekmart.
---

# Coding Standards

Monorepo-wide coding standards for Larekmart.

## TypeScript Standards

1. **Strict Type Safety**: `strict`, `noUncheckedIndexedAccess`, and `isolatedModules` are enforced via `@repo/typescript-config/base.json`.
2. **Never Use `any`**: Use `unknown` with runtime type guards (e.g. Zod validation) instead of `any`.
3. **Explicit ESM Imports**: Follow the local file's extension style when importing local modules (`./utils/mailer.js` or `./utils/mailer`).
4. **Shared Contracts**: Cross-boundary types, enums, constants, and Zod schemas MUST reside in `@repo/types`.
5. **Type-Only DB Imports**: In `@repo/types`, import database models using `import type` to prevent bundling database clients into client-side code.

## Backend Service Standards

1. **Framework & Runtime Discipline**:
   - `apps/product-service` & `apps/auth-service`: Express 5 (Node.js ESM)
   - `apps/order-service`: Fastify 5 (Node.js ESM)
   - `apps/payment-service`: Hono (Node.js ESM)
   - `apps/analytic-service`: Express 5 (Node.js ESM)
   - `apps/email-service`: Headless Node.js worker
   - `apps/notification-service`: Go 1.22+ (Chi, pgxpool, go-redis, Gorilla WebSocket, segmentio/kafka-go)
2. **Error Responses**: HTTP endpoints return `{ message: string }` JSON with appropriate HTTP status codes (`400`, `401`, `403`, `404`, `500`).
3. **Auth Guards**: Apply `shouldBeUser` or `shouldBeAdmin` to protected routes. Derive `userId` from the verified session claims, never from client request bodies.
4. **Kafka Resiliency**: Wrap consumer handlers in structured error handling (try/catch or Go recover) to prevent unhandled message exceptions from terminating the consumer loop. Always use the `{ value: payload }` envelope.
5. **Health Checks**: HTTP services expose `GET /health` returning structured health JSON with dependency statuses (Postgres, Redis, MongoDB). HTTP services also expose `GET /ready` for deployment readiness probes.

## Frontend Standards

1. **Server Components First**: Use React Server Components by default; add `"use client"` only for client state, browser events, or browser APIs.
2. **Data Fetching**:
   - Server Components: `auth().getToken()` with standard `fetch()` using `process.env.NEXT_PUBLIC_*_SERVICE_URL`.
   - Client Components: `useAuth().getToken()` for authenticated requests.
3. **Forms**: Use `react-hook-form` + `zodResolver` utilizing shared schemas from `@repo/types`.
4. **Design System**: Use Tailwind CSS v4 design tokens and CSS variables in `src/app/globals.css`. Do not hardcode arbitrary hex codes.
5. **Images**: Always use `next/image` with remote domains registered in `next.config.ts`.
6. **Animation Boundaries & Framer Motion**:
   - Use `framer-motion` for client-only interactive overlays, slide-overs, modals (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`), and workflow transitions (`<AnimatePresence mode="wait">`).
   - Do NOT use `<motion.button>` or dynamic `layoutId` on static server-rendered product or category grids (`ProductCard`, `CategoriesClient`, `FlashDeals`). Framer Motion SSR generates `tabindex="0"` and `data-motion-id` attributes that cause React 19 hydration mismatches. Use Tailwind CSS transitions for static SSR elements.
7. **SSR Hydration Safety (React 19 & Next.js 16)**:
   - Guard `localStorage`-backed Zustand store reads with an `isMounted` flag before rendering dependent attributes on the client.
   - Add `suppressHydrationWarning` to SVG icons (to protect against browser extensions injecting attributes like `data-motion-id`) and live countdown tickers/timestamps.
