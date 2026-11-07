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
   - `apps/order-service`, `apps/catalog-service`, `apps/search-service`, `apps/user-service`, `apps/review-service`, `apps/wishlist-service`, `apps/tax-service`, `apps/pricing-service`, `apps/seller-service`, `apps/commission-service`, `apps/chat-service`: Fastify 5 (Node.js ESM)
   - `apps/vendor-service` (NestJS 10), `apps/payout-service` (NestJS 11), `apps/support-service` (NestJS 11): NestJS on Fastify (Node.js ESM)
   - `apps/payment-service`, `apps/inventory-service`, `apps/media-service`, `apps/promotion-service`: Hono 4 (Node.js ESM)
   - `apps/shipping-service`, `apps/return-service`: Koa (Node.js ESM)
   - `apps/product-service`, `apps/auth-service`, `apps/cart-service`: Express 5 (Node.js ESM)
   - `apps/analytic-service`, `apps/notification-service`: Go 1.22+ (Chi, pgxpool, go-redis, Gorilla WebSocket, segmentio/kafka-go)
   - `apps/recommendation-service`: Python 3.12+ (FastAPI, SQLAlchemy, pgvector, Celery)
   - `apps/email-service`: Headless Node.js worker
2. **Financial Precision & Double-Entry Invariants (`Decimal.js`)**:
   - All financial and commission computations in `commission-service` and `payout-service` MUST strictly use `Decimal.js` with explicit rounding modes (`Decimal.ROUND_HALF_UP`) and integers/precise decimal types to completely eliminate IEEE 754 floating-point drift.
   - Payout ledger postings (`ledger_entries`) are strictly append-only and must be balanced zero-sum transactions (`SUM(debit) == SUM(credit)`). Current balances must always be dynamically evaluated (`SUM(credit) - SUM(debit)`).
3. **Error Responses**: HTTP endpoints return `{ message: string }` JSON with appropriate HTTP status codes (`400`, `401`, `403`, `404`, `500`).
4. **Auth Guards**: Apply `shouldBeUser`, `shouldBeAdmin`, `shouldBeSellerOrAdmin`, or `requireSellerStaffOrAdmin` to protected routes. Derive `userId` from the verified session claims, never from client request bodies.
5. **Kafka Resiliency**: Wrap consumer handlers in structured error handling (try/catch or Go recover) to prevent unhandled message exceptions from terminating the consumer loop. Always use the `{ value: payload }` envelope.
6. **Health Checks**: HTTP services expose `GET /health` returning structured health JSON with dependency statuses (Postgres, Redis, MongoDB). HTTP services also expose `GET /ready` for deployment readiness probes.

## Frontend Standards

### React 19 & Next.js Standards (`apps/client`, `apps/admin`)

1. **Server Components First**: Use React Server Components by default; add `"use client"` only for client state, browser events, or browser APIs.
2. **Data Fetching**:
   - Server Components: `auth().getToken()` with standard `fetch()` using `getApiGatewayUrl()` from `@/services/gateway.service`.
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

### Vue 3 & Nuxt 3 Standards (`apps/seller`)

1. **Composition API & SFCs**: Use `<script setup lang="ts">` with strict TypeScript typing across all components, composables, and pages.
2. **State Management Division**:
   - Use Pinia (`stores/auth.store.ts`, `stores/seller.store.ts`, `stores/ui.store.ts`) strictly for client-only state (active store workspace, sidebar toggle, search query, toasts).
   - Use TanStack Vue Query (`@tanstack/vue-query`) for all server data fetching, mutations, background refetching, and cache invalidation. Do not duplicate server data in Pinia.
3. **API & Token Injection**: Use the `useApi` composable for all HTTP requests to automatically inject the Clerk Bearer token and route through the API Gateway (`/api/v1/*`).
4. **Forms & Validation**: Use VeeValidate 4 + `@vee-validate/zod` with shared schemas from `@repo/types`.
5. **Animations (GSAP 3)**: Scope GSAP timelines to component lifecycles using Vue lifecycle hooks (`onMounted`, `onUnmounted`) with cleanups. Respect `prefers-reduced-motion`.
6. **Real-Time Communications**: Use Socket.IO client (`socket.io-client`) via `useSocket` plugin connected to `/socket.io` through the API Gateway. Ensure listeners are cleaned up on unmount.
7. **SSR Hydration Safety**: Guard browser-only globals (`window`, `localStorage`, `document`) with `import.meta.client` or place inside `onMounted`.
