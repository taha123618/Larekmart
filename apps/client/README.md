# Customer Storefront (`apps/client`)

The high-performance, customer-facing marketplace storefront for Larekmart. Built with modern e-commerce patterns inspired by global leaders (AliExpress, Daraz, Amazon, and Alibaba), featuring rich animations, responsive layouts, real-time OpenSearch autocomplete, AI-curated recommendation shelves, persistent client state, and secure multi-channel checkout.

## Tech Stack

- **Framework**: **Next.js 16** (`next@16.4.0` with App Router, Turbopack, React 19)
- **Styling**: Tailwind CSS v4, custom marketplace design tokens, glassmorphism utilities (`globals.css`)
- **Animation**:
  - **GSAP & `@gsap/react` (`useGSAP`)**: Timeline-based hero sequence animations, promotional banner carousels, and entrance choreography.
  - **Framer Motion (`framer-motion`)**: High-performance physics-based slide-overs, modals, and workflow step transitions (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`, and multi-step cart checkout).
  - **Tailwind GPU Transitions**: Native hardware-accelerated transforms for high-cardinality static SSR product grids and category ribbons.
- **State Management**: **Zustand**
  - `cartStore.ts`: Optimistic client operations synchronized with authoritative `cart-service` server calculations.
  - `wishlistStore.ts`: Persistent customer saved-items with `localStorage`, hydration mounts, and 1-click move-to-cart.
  - `uiStore.ts`: Shared UI state for slide-over `CartDrawer`, `QuickViewModal`, and search overlay.
- **UI Primitives**: Radix UI (`@radix-ui/react-*`), `clsx`, `tailwind-merge` (`cn` helper in `src/lib/utils.ts`)
- **Forms & Validation**: React Hook Form, `@hookform/resolvers/zod`, Zod
- **Payments**: Stripe (`@stripe/react-stripe-js`, `@stripe/stripe-js`) & Cash on Delivery (COD)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Port**: `3002`

## Animation & Hydration Architecture

The storefront couples **Framer Motion** for dynamic overlays and **Tailwind CSS GPU transitions** for static SSR content to guarantee silky 60fps animations alongside zero React 19 hydration mismatches:

- **Framer Motion Overlays (`AnimatePresence`)**:
  - **`CartDrawer.tsx`**: Off-canvas slide-over using spring physics (`type: "spring", damping: 30, stiffness: 300`), backdrop opacity fade, and animated item list removals.
  - **`WishlistDrawer.tsx`**: Slide-over drawer with spring entry and empty-state layout transition.
  - **`QuickViewModal.tsx`**: Centered modal with smooth backdrop fade and scale-in (`scale: 0.94 -> 1`).
  - **`cart/page.tsx`**: Multi-step checkout transitions (`<AnimatePresence mode="wait">`) between Review, Shipping, and Payment stages, with item dismissal animations (`<AnimatePresence mode="popLayout">`).
- **SSR Hydration Resilience**:
  - **No Motion on Static SSR Grids**: Product listings (`ProductCard.tsx`) and categories (`CategoriesClient.tsx`) use GPU-accelerated Tailwind transitions (`hover:scale-[1.02] active:scale-95 transition-all`) rather than `<motion.button>` or dynamic `layoutId` to prevent server attribute injection (`tabindex="0"`, `data-motion-id`) from mismatching client DOM.
  - **LocalStorage Mount Guards**: Persistent Zustand stores (`wishlistStore`) guard initial client rendering via `isMounted` checks to prevent SSR hydration warnings.
  - **Extension & Clock Immunity**: Dynamic countdown tickers (`FlashDeals.tsx`) and header icon SVGs (`Navbar.tsx`) include `suppressHydrationWarning` to remain resilient against browser extension attribute injections.

## Key Marketplace Features

- **Multi-Tier Header Navigation**:
  - Top announcement bar with worldwide delivery indicator, 100% Buyer Protection badge, and order tracking shortcuts.
  - Omnibar search powered by OpenSearch with debounced suggestions, search history, and direct category deep-linking.
  - Wishlist counter with slide-over drawer ([`WishlistDrawer.tsx`](src/components/WishlistDrawer.tsx)).
  - Real-time Shopping Cart badge with slide-over drawer ([`CartDrawer.tsx`](src/components/CartDrawer.tsx)).
  - Category ribbon with department mega-menu and promo callouts.
- **GSAP Animated Hero Section** ([`HeroBanner.tsx`](src/components/HeroBanner.tsx)):
  - Promotional carousel driven by `useGSAP` timelines.
  - Side promotional cards with welcome vouchers and buyer protection escrow guarantees.
- **Flash Deals & Daily Steals** ([`FlashDeals.tsx`](src/components/FlashDeals.tsx)):
  - Real-time countdown ticker (`HH:MM:SS`) and stock progression indicators.
- **Marketplace Categories** ([`MarketplaceCategories.tsx`](src/components/MarketplaceCategories.tsx)):
  - Department cards with vibrant gradients and micro-hover elevations.
- **Interactive Product Details** ([`products/[id]/page.tsx`](src/app/products/[id]/page.tsx)):
  - Product gallery with thumbnail switching and hover zoom preview ([`ProductGallery.tsx`](src/components/ProductGallery.tsx)).
  - Specifications, customer reviews with rating distributions, and shipping policies ([`ProductTabs.tsx`](src/components/ProductTabs.tsx)).
  - Real-time warehouse availability checks and interaction telemetry (`VIEW`, `ADD_TO_CART`).
- **Product Card** ([`ProductCard.tsx`](src/components/ProductCard.tsx)):
  - Discount tags, ratings, color swatches with instant image swapping, wishlist toggle, and quick view modal trigger ([`QuickViewModal.tsx`](src/components/QuickViewModal.tsx)).
- **Trust & Assurance**:
  - Marketplace guarantee indicators ([`TrustBadges.tsx`](src/components/TrustBadges.tsx)).
  - Multi-column footer with newsletter voucher subscription, payment processor badges, and SSL security badges ([`Footer.tsx`](src/components/Footer.tsx)).

## Environment Variables

Copy `.env.example` to `.env`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:8090
NEXT_PUBLIC_PRODUCT_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ORDER_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_PAYMENT_SERVICE_URL=http://localhost:8002
NEXT_PUBLIC_SEARCH_SERVICE_URL=http://localhost:8006
NEXT_PUBLIC_INVENTORY_SERVICE_URL=http://localhost:8007
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=http://localhost:8005
NEXT_PUBLIC_NOTIFICATION_WS_URL=ws://localhost:8005/ws
NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL=http://localhost:8008
NEXT_PUBLIC_CART_SERVICE_URL=http://localhost:8009
NEXT_PUBLIC_CATALOG_SERVICE_URL=http://localhost:8010
NEXT_PUBLIC_SHIPPING_SERVICE_URL=http://localhost:8011
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Development Commands

```bash
# Run client dev server with Turbopack (Port 3002)
pnpm --filter client dev

# Type check across client application
pnpm --filter client check-types

# Production build with Next.js 16
pnpm --filter client build

# Lint source code
pnpm --filter client lint
```
