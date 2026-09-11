# AGENTS.md — apps/admin (dashboard)

Scope: `apps/admin` only. Root rules still apply — start there.

## What this app is

Next.js 15 (App Router, Turbopack) admin dashboard on `:3003`. It owns product/category
management, user administration (against Clerk), and an order dashboard with charts. It
uses shadcn/ui, TanStack Query, TanStack Table, Recharts, and react-hook-form + Zod.

## Where things live

- `src/app/` — App Router routes. Look for `(dashboard)` for the protected admin shell and
  `(auth)` for clerk sign-in / unauthorized fallback.
- `src/components/` — UI: `AddProduct`, `AddCategory`, `CardList`, `AddUser`, data tables,
  chart components, etc.
- `src/components/ui/` — shadcn/ui primitives. Add new primitives here when you need one.
- `src/lib/utils.ts` — contains `cn()`.
- `src/middleware.ts` — admin routing guard using `createRouteMatcher` and
  `sessionClaims.metadata.role === "admin"`.

## Remix-style rules for this app

- **Server components by default.** Use `"use client"` only where you need interactivity.
- **Admin access is enforced both ways:**
  - Frontend: `src/middleware.ts` protects the dashboard routes and redirects non-admins.
  - Backend: services still enforce authorization. Do not rely on the frontend gate alone.
- **Data fetching in server components:** `auth()` from `@clerk/nextjs/server` for session
  info; fetch service data with `Authorization: Bearer <token>` and
  `process.env.NEXT_PUBLIC_*_SERVICE_URL`.
- **Interactive screens:** TanStack Query (`useQuery`/`useMutation`) for mutations and
  polling-heavy screens. Forms use `react-hook-form` + Zod.
- **Tables:** TanStack Table with per-section column definitions.
- **Charts:** Recharts for dashboard analytics.
- **UI:** shadcn/ui under `src/components/ui`. Keep `cn()` usage consistent with the rest
  of the app. Icons from `lucide-react`. Toasts via `react-toastify`.
- **Styling:** Tailwind v4 + CSS variables in `src/app/globals.css`. Prefer existing palette
  classes over raw hex.

## Auth model

- Clerk frontend with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Server-side Clerk with `CLERK_SECRET_KEY` and `@clerk/nextjs/server`.
- Admin role is `sessionClaims.metadata.role === "admin"`.
- User admin operations in the UI call `auth-service` over HTTP with a Clerk token. The
  service enforces admin-only access.

## Backend calls from this app

This app talks HTTP to:

- `product-service` — products, categories.
- `order-service` — orders, order chart.
- `auth-service` — user admin (list, get, create, delete).
- It does not touch Postgres/Mongo/Kafka directly.

Follow the existing fetch pattern with Clerk token + service URL env vars. If you add a new
Route Handler in this app, mirror the existing Clerk token pattern rather than inventing a
new one.

## What not to do

- Do not weaken the admin middleware to “make things easier.”
- Do not put mutating admin actions behind only a UI guard; the backend must still authorize.
- Do not import service internals into the frontend.
- Do not paste raw hex colors; use Tailwind classes and existing design tokens.
- Do not duplicate Zod schemas from `@repo/types` when the existing ones fit.

## Verification

- `pnpm --filter admin check-types`
- `pnpm --filter admin build`
- `pnpm lint` (runs on client and admin together from the root)

If you change admin CRUD flows, test against running services. There is no test runner in
this repo yet.
