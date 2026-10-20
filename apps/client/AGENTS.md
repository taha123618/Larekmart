# AGENTS.md — apps/client (storefront)

Scope: `apps/client` only. Root rules still apply — start there.

## What this app is

Next.js 16 (App Router, Turbopack, React 19) marketplace storefront on `:3002`. It owns all customer-facing
interaction: marketplace browsing, search & discovery, AI recommendations, wishlists, cart,
Stripe checkout, COD placement, and order tracking. It calls backend services over HTTP via the
unified API Gateway (`NEXT_PUBLIC_API_GATEWAY_URL`, port `8080`) with a Clerk token; it does not touch
Postgres, Mongo, or Kafka directly.

### Technology Stack

- **Next.js 16** (`next@16.4.0`) with App Router and Turbopack
- **React 19**
- **Tailwind CSS v4** with custom marketplace theme tokens, Obsidian dark mode (`#0b0f19`), and glassmorphism utilities
- **GSAP & `@gsap/react` (`useGSAP`)** for hero entrances, promotional banner carousels, and complex timelines
- **Framer Motion (`framer-motion`)** for interactive micro-interactions, layout transitions, drawers, and modal animations
- **Lenis (`lenis`)** for high-performance inertia smooth scrolling with automatic route change resets and unmount cleanup
- **Zustand** for shared client-side application state:
  - `cartStore.ts`: local cart & synchronization with server cart
  - `wishlistStore.ts`: persistent client wishlist with localStorage
  - `uiStore.ts`: modal, cart drawer, quick-view, and search overlay state
- **Clerk Authentication** (`@clerk/nextjs`)
- **Stripe** (`@stripe/react-stripe-js`, `@stripe/stripe-js`) for secure card checkout
- **TanStack React Query** for server-state caching

## Where things live

- `src/app/` — Next App Router routes (`/`, `/products`, `/products/[id]`, `/cart`, `/orders`, `/account`, `/track`, `/return`, `/sign-in`, `/sign-up`).
- `src/components/` — UI components:
  - `Navbar.tsx` — Multi-tier marketplace header with announcement bar, omnibar search, category ribbon, and theme switch.
  - `SearchBar.tsx` — Debounced OpenSearch input with search history pills, rich suggestions, and keyboard navigation.
  - `HeroBanner.tsx` — GSAP-animated promotional banner carousel with side bonus cards.
  - `FlashDeals.tsx` — Limited-time deals with live countdown ticker, stock progress indicators, and `FALLBACK_FLASH_PRODUCTS`.
  - `MarketplaceCategories.tsx` — Visual category cards with micro-hover interactions and `FALLBACK_CATEGORIES`.
  - `TrustBadges.tsx` — Buyer protection, shipping, and payment confidence indicators.
  - `FeaturedSection.tsx` — High-velocity showcase with `FALLBACK_PRODUCTS` for featured, new arrivals, and best sellers.
  - `ShopCTA.tsx` — Dynamic promotional banner fetching from `promotion.service.ts` (`GET /api/v1/promotions/active`), 1-click copy coupon codes, fallback VIP discounts (`LAREK20`), and category shortcuts.
  - `Testimonials.tsx` — Verified customer reviews section with 45k+ reviews summary and spotlight reviews.
  - `ProductCard.tsx` — High-performance card with discount badges, color swatches, rating stars, wishlist toggle, and quick add.
  - `CartDrawer.tsx` — Slide-over cart drawer with live subtotal and direct checkout links.
  - `WishlistDrawer.tsx` — Slide-over drawer for customer saved items with move-to-cart.
  - `QuickViewModal.tsx` — Full product quick-view modal with variant selection and image zoom.
  - `NotificationBell.tsx` — Live notification bell with WebSocket status indicator and glassmorphic dropdown.
  - `ShippingForm.tsx` — Modern glassmorphic 2-column shipping form with live carrier quotes and COD toggle.
  - `CodConfirmationForm.tsx` — Cash on Delivery order confirmation modal and receipt summary.
  - `ProductTabs.tsx` — Product details, specs, and live customer reviews with rating distribution breakdown, verified badges, helpful voting, report dialog, and photo lightbox.
  - `WriteReviewModal.tsx` — Modal for composing and editing customer reviews with star ratings, text feedback, and media uploads via MinIO/S3.
  - `returns/RequestReturnModal.tsx` — Self-service customer return modal with item multi-selection, partial quantities, reason picker, and evidence image/video upload.
  - `Footer.tsx` — Multi-column marketplace directory with newsletter signup and payment badges.
  - `common/ScrollToTop.tsx` — Viewport scroll progress bar and circular SVG progress floating action button.
- `src/services/` — Frontend client services (`return.service.ts`, `tax.service.ts`, `promotion.service.ts`, `review.service.ts`, `wishlist.service.ts`, `media.service.ts`, `shipping.service.ts`, `catalog.service.ts`, `recommendation.service.ts`, `cart.service.ts`, `notification.service.ts`).
- `src/hooks/` — Custom hooks (`use-lenis.ts` with cancelAnimationFrame and pathname listener).
- `src/stores/` — Zustand stores (`cartStore.ts`, `wishlistStore.ts`, `uiStore.ts`).
- `src/lib/utils.ts` — `cn(...)` utility helper (`clsx` + `tailwind-merge`).

## Animation & Motion Architecture

The client storefront uses a hybrid animation strategy optimized for React 19 and Next.js 16:

1. **Lenis (`lenis`, `use-lenis.ts`)**:
   - Manages smooth inertia scrolling across the entire storefront window.
   - Clean up `requestAnimationFrame` on unmount to prevent background worker leaks.
   - Automatically scrolls to top on route change using `usePathname()`.

2. **GSAP (`@gsap/react`, `useGSAP`)**:
   - Reserved for complex, coordinated multi-element timelines, the hero entrance choreography, and the promotional carousel in `HeroBanner.tsx`.
   - Clean up timelines with GSAP's React context lifecycle.

3. **Framer Motion (`framer-motion`)**:
   - **Allowed Scope**: Client-only overlays, slide-overs, modals, and workflow transitions that are unmounted on initial SSR or gated behind `AnimatePresence`:
     - `CartDrawer.tsx`: spring slide-over (`x: "100%" -> 0`), backdrop fade, and item removal list animations.
     - `WishlistDrawer.tsx`: spring slide-over, backdrop fade, and empty-state transitions.
     - `QuickViewModal.tsx`: spring scale-up (`scale: 0.94 -> 1`), backdrop fade.
     - `src/app/cart/page.tsx`: animated multi-step checkout workflow (`<AnimatePresence mode="wait">`) and cart item removals (`<AnimatePresence mode="popLayout">`).
   - **Forbidden Scope**: Do NOT use `<motion.button>`, `<motion.div layoutId>`, or Framer Motion tap/hover hooks on high-cardinality static SSR product or category grids (`ProductCard.tsx`, `CategoriesClient.tsx`, `FlashDeals.tsx`). Framer Motion's server-rendered markup injects `tabindex="0"` and internal `data-motion-id` attributes that mismatch with client DOM hydration in React 19.

4. **Tailwind CSS GPU Transitions**:
   - For all static server-rendered product cards, department grids, countdown tickers, and navigation links, use standard GPU-accelerated Tailwind classes (e.g. `transition-all duration-300 hover:scale-[1.02] active:scale-95`).

## SSR Hydration Safety Rules

React 19 and Next.js 16 enforce strict hydration equality between server HTML and client initial render. Always follow these rules:

1. **Client Storage & Stores (`wishlistStore`, `cartStore`)**:
   - Never query `localStorage` directly during server rendering or the initial client render pass.
   - Wrap local storage operations in `typeof window !== "undefined"` and dummy SSR fallbacks.
   - Guard persistent state queries with an `isMounted` state flag:
     ```tsx
     const [isMounted, setIsMounted] = useState(false);
     useEffect(() => {
       setIsMounted(true);
     }, []);
     const isFavorited = isMounted ? isInWishlist(product.id) : false;
     ```
   - Add `suppressHydrationWarning` on interactive toggle buttons (e.g. wishlist heart buttons) that switch state upon client mount.

2. **Third-Party & Browser Extension Defense**:
   - Chrome extensions (e.g. Motion, accessibility tools) inject attributes like `data-motion-id="svg 2"` into SVGs before React attaches event listeners.
   - Add `suppressHydrationWarning` on dynamic SVG icons in the navigation or header (e.g. `<Sparkles suppressHydrationWarning />` in `Navbar.tsx`).

3. **Dynamic Tickers & Timestamps**:
   - Countdown timers and date-based displays (e.g. `FlashDeals.tsx`) drift between SSR server time and client hydration time.
   - Apply `suppressHydrationWarning` to countdown containers in `FlashDeals.tsx` to prevent server/client second drift mismatches.

## Storefront Engineering Rules

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
  `@stripe/stripe-js`. `StripePaymentForm` is the current checkout entry point with instant COD toggle fallback.
- **Images:** `next/image`. If you add a new remote image host, register it in
  `next.config.ts`.
- **Styling:** Tailwind v4 utility classes, Obsidian dark mode tokens (`#0b0f19`), and CSS variables in `src/app/globals.css`.
  Reuse the existing palette classes; do not paste raw hex values.

## Auth Model

- Clerk is the only auth story. Frontend uses `@clerk/nextjs` and `@clerk/nextjs/server`.
- The customized publishable key lives in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Publishable keys are safe in the browser; secret keys never are.
- Order pages typically require an authenticated user. Gate them with Clerk route protection
  and fetch orders with the user’s token.

## Backend Calls from this App

This app talks HTTP to `product-service`, `order-service`, `payment-service`,
`search-service` (autocomplete only), `recommendation-service` (`NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL` :8008),
`catalog-service` (`NEXT_PUBLIC_CATALOG_SERVICE_URL` :8010), `shipping-service` (`NEXT_PUBLIC_SHIPPING_SERVICE_URL` :8011),
`user-service` (`NEXT_PUBLIC_USER_SERVICE_URL` :8012), `review-service` (`NEXT_PUBLIC_REVIEW_SERVICE_URL` :8014),
`wishlist-service` (`NEXT_PUBLIC_WISHLIST_SERVICE_URL` :8015), `promotion-service` (`NEXT_PUBLIC_PROMOTION_SERVICE_URL` :8016),
and `tax-service` (`NEXT_PUBLIC_TAX_SERVICE_URL` :8017). It never calls `auth-service` directly — Clerk handles user auth.

Shipping & tracking integration:

- `shipping.service.ts` provides helpers to calculate multi-carrier delivery rates (`fetchShippingRates`), list methods (`fetchShippingMethods`), and retrieve tracking checkpoints (`fetchTracking`).
- `ShippingForm.tsx` dynamically queries rates and supports Cash on Delivery (COD) calculations.
- `CodConfirmationForm.tsx` handles cash-on-delivery order placement without Stripe.
- `/track` allows customers to inspect live carrier scan events, COD collection status, and delivery milestones.

Catalog & Fallback resilience:

- `catalog.service.ts` provides discovery queries for categories and featured products.
- `MarketplaceCategories.tsx`, `FeaturedSection.tsx`, and `FlashDeals.tsx` embed typed fallback datasets to ensure the homepage always renders cleanly during database seeding or offline development.

Recommendation integration:

- `recommendation.service.ts` provides client/server fetch helpers for `getHomeRecommendations`, `getCategoryRecommendations`, `getRecentlyViewedRecommendations`, `getPersonalizedRecommendations`, and telemetry helpers `sendInteraction` and `sendAnalyticsEvent`.
- `RecommendationSection.tsx` dynamically resolves Clerk `useAuth().userId` and renders personalized, trending, category, and recently-viewed shelves.
- `ProductInteraction.tsx` dispatches zero-throw interaction telemetry (`VIEW`, `ADD_TO_CART`) so user affinity models stay continuously updated.

Customer Returns & RMA Hub:

- `return.service.ts` provides typed client SDK helpers for submitting return requests (`createReturnRequest`), fetching customer returns (`getCustomerReturns`, `getReturnDetails`), attaching media evidence (`attachEvidence`), and tracking reverse shipments (`submitTracking`).
- `/account/returns` provides a dedicated returns center with real-time status badges, tracking summaries, and printable return label slips.
- Returns can be triggered directly from delivered orders on `/orders` via `RequestReturnModal`.

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

```bash
pnpm --filter client check-types
pnpm --filter client build
pnpm --filter client lint
```

If you change cart, checkout, or order pages, test the flow manually against running
services. There is no general JavaScript test runner in this repo yet; verification uses type-checking, builds, linting, and manual flows.
