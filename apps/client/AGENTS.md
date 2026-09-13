# AGENTS.md — apps/client (storefront)

Scope: `apps/client` only. Root rules still apply — start there.

## What this app is

Next.js 15 (App Router, Turbopack) storefront on `:3002`. It owns all customer-facing
interaction: browse, cart, Stripe checkout, and order history. It calls backend services
over HTTP with a Clerk token; it does not touch Postgres, Mongo, or Kafka directly.

## Where things live

- `src/app/` — Next App Router routes. Route groups: `(auth)` for sign-in/up, `(main)`
  or similar layout groups for the storefront, `(checkout)` for cart/checkout/order pages
  depending on the current tree.
- `src/components/` — UI components. `StripePaymentForm`, `Navbar`, `ProductCard`,
  `ProductList`, `SearchBar`, `Filter`, `Cart`, profile buttons, etc.
- `src/stores/cartStore.ts` — Zustand cart store with `persist` to `localStorage`.
- `src/middleware.ts` — Clerk frontend middleware (sign-in/up catch-alls, protected
  routes).

## Remix-style rules for this app

- **Server components by default.** Add `"use client"` only for state, effects, event
  handlers, or browser APIs. Do not make a whole page client just to fetch data.
- **Fetch service data server-side with `auth().getToken()`** (`@clerk/nextjs/server`).
  Client components that must call services use `useAuth().getToken()`.
- **Service URLs via env.** Always `process.env.NEXT_PUBLIC_*_SERVICE_URL`. Never hardcode
  `localhost:8000` and friends.
- **Cart is client state only.** Keep it in Zustand + localStorage. Do not introduce server
  state for the cart unless the product/service behavior actually requires it.
- **Forms:** `react-hook-form` + Zod. Prefer schemas from `@repo/types` if they already
  exist and fit; do not duplicate them.
- **Payments:** Stripe custom checkout UI via `@stripe/react-stripe-js` and
  `@stripe/stripe-js`. `StripePaymentForm` is the current checkout entry point.
- **Images:** `next/image`. If you add a new remote image host, register it in
  `next.config.ts`.
- **Styling:** Tailwind v4 utility classes and the CSS variables in `src/app/globals.css`.
  Reuse the existing palette classes; do not paste raw hex values.

## Auth model

- Clerk is the only auth story. Frontend uses `@clerk/nextjs` and `@clerk/nextjs/server`.
- The customized publishable key lives as a literal in `apps/client/src/components/StripePaymentForm.tsx`.
  Treat that file as the place to convert to `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` when
  someone gets around to it. Publishable keys are safe in the browser; secret keys never are.
- Order pages typically require an authenticated user. Gate them with Clerk route protection
  and fetch orders with the user’s token.

## Backend calls from this app

This app talks HTTP to `product-service`, `order-service`, `payment-service`, and
`search-service` (autocomplete only). It never calls `auth-service` directly — Clerk
handles user auth.

Product listing and search:

- `SearchBar` (client component) fetches debounced autocomplete from search-service's
  `GET /api/v1/search/suggestions` through `NEXT_PUBLIC_SEARCH_SERVICE_URL`. It calls the
  service **directly** (there is no gateway), supports keyboard navigation, and silently
  degrades to a plain input when the service is unavailable or the env var is unset.
- Suggestions are rich (`SuggestionItem`: id, name, brand, price, images), so selecting one
  deep-links to `/products/<id>`; plain `Enter` runs a text search instead.
- Recent searches are kept in `localStorage` under `larekmart:recent-searches` and shown
  when the input is focused and empty. Search-service responses are cached in Redis, so the
  debounce plus that cache keep typing well under the per-IP rate limit.
- `ProductList` (server component) reads the products page from product-service's
  OpenSearch-backed `GET /products/search`: the `SearchBar` `search` param maps to `q`, the
  `Categories` slug to `categorySlug`, and the `Filter` dropdown sort to the search API's
  sort vocabulary (`asc`/`desc` → `price_asc`/`price_desc`).
- `Filter` also renders **color, size, and price** controls built from the facets returned
  with each result set (`?color=`, `?size=`, `?min_price=`, `?max_price=`). Color and size
  are **multi-select**: the chosen values are stored comma-separated (`?color=black,red`,
  sorted so the URL stays canonical) and OR'd within their own facet, while each facet
  still narrows the others — picking a colour does not hide the remaining colour options.
- `ActiveFilters` (client component) sits between the filter panel and the product grid and
  renders each active color, size, and price selection as a pill with its own ×, so one
  value can be dropped without reopening the panel. It reads the URL only — bulk clearing
  stays with the filter panel.
- It **degrades to the PostgreSQL listing `GET /products`** when the search endpoint is
  unavailable, so the storefront keeps working if OpenSearch is down.
- The homepage teaser (`params="homepage"`) always uses `GET /products?limit=8`.

Common patterns:

- Server component fetch with `Authorization: Bearer <token>`.
- Client component fetch with `useAuth().getToken()`.
- Mutations in client components may use TanStack Query in this app only if a screen is
  interactive enough to warrant it. The admin app leans on TanStack Query more heavily;
  the client app mostly does direct fetches today.

## What not to do

- Do not import backend service internals into the frontend.
- Do not add a second auth path or custom session store.
- Do not write service-style middleware in a Next app to “protect” API routes that already
  live behind Clerk. If you add a new Route Handler, match the existing Clerk token pattern.
- Do not duplicate Zod schemas just because they exist in a service.

## Verification

- `pnpm --filter client check-types`
- `pnpm --filter client build`
- `pnpm lint` (runs on client and admin together from the root)

If you change cart, checkout, or order pages, test the flow manually against running
services. There is no general JavaScript test runner in this repo yet; verification uses type-checking, builds, linting, and manual flows.
