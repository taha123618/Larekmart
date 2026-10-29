# Customer Storefront (`apps/client`)

The high-performance, customer-facing marketplace storefront for Larekmart. Built with modern e-commerce patterns inspired by global leaders (AliExpress, Daraz, Amazon, and Alibaba), featuring rich animations, responsive layouts, real-time OpenSearch autocomplete, AI-curated recommendation shelves, persistent client state, multi-carrier shipping, Cash on Delivery, and secure Stripe checkout.

## Tech Stack

- **Framework**: **Next.js 16** (`next@16.4.0` with App Router, Turbopack, React 19)
- **Styling**: Tailwind CSS v4, custom marketplace design tokens, Obsidian dark theme (`#0b0f19`), glassmorphism utilities (`globals.css`)
- **Animation & Motion**:
  - **Lenis (`lenis`)**: Inertia-based smooth window scrolling with automatic route change resets and unmount cleanup.
  - **GSAP & `@gsap/react` (`useGSAP`)**: Timeline-based hero sequence animations, promotional banner carousels, and entrance choreography.
  - **Framer Motion (`framer-motion`)**: High-performance physics-based slide-overs, modals, and workflow step transitions (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`, and multi-step cart checkout).
  - **Tailwind GPU Transitions**: Native hardware-accelerated transforms for high-cardinality static SSR product grids and category ribbons.
- **State Management**: **Zustand**
  - `cartStore.ts`: Optimistic client operations synchronized with authoritative `cart-service` server calculations.
  - `wishlistStore.ts`: Persistent customer saved-items with `localStorage`, hydration mounts, and 1-click move-to-cart.
  - `uiStore.ts`: Shared UI state for slide-over `CartDrawer`, `QuickViewModal`, and search overlay.
- **UI Primitives**: Radix UI (`@radix-ui/react-*`), `clsx`, `tailwind-merge` (`cn` helper in `src/lib/utils.ts`)
- **Forms & Validation**: React Hook Form, `@hookform/resolvers/zod`, Zod
- **Payments & Logistics**: Stripe (`@stripe/react-stripe-js`, `@stripe/stripe-js`), Cash on Delivery (COD), and multi-carrier adapters (TCS, Leopards, DHL)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Port**: `3002`

## Key Marketplace Features

- **Multi-Tier Header Navigation**:
  - Top announcement bar with worldwide delivery indicator, 100% Buyer Protection badge, and order tracking shortcuts.
  - Omnibar search powered by OpenSearch with debounced suggestions, search history pills with 1-click clearance, and direct category deep-linking ([`SearchBar.tsx`](src/components/SearchBar.tsx)).
  - Animated high-contrast theme toggle for Light and Obsidian Dark modes ([`ThemeToggleAnimated.tsx`](src/components/common/ThemeToggleAnimated.tsx)).
  - Live notification center with WebSocket status indicator ([`NotificationBell.tsx`](src/components/NotificationBell.tsx)).
  - Wishlist counter with slide-over drawer ([`WishlistDrawer.tsx`](src/components/WishlistDrawer.tsx)).
  - Real-time Shopping Cart badge with slide-over drawer ([`CartDrawer.tsx`](src/components/CartDrawer.tsx)).
  - Category ribbon with department mega-menu and promotional callouts.
- **GSAP Animated Hero Section** ([`HeroBanner.tsx`](src/components/HeroBanner.tsx)):
  - Promotional carousel driven by `useGSAP` timelines.
  - Side promotional cards with welcome vouchers and buyer protection escrow guarantees.
- **Trust & Assurance Badges** ([`TrustBadges.tsx`](src/components/TrustBadges.tsx)):
  - 5-pillar marketplace guarantees (Buyer Protection, Global Express, 30-Day Free Return, 24/7 Support, Safe Payments).
- **Marketplace Categories** ([`MarketplaceCategories.tsx`](src/components/MarketplaceCategories.tsx)):
  - Visual department tiles with micro-hover elevations and fallback data resilience.
- **Flash Deals & Daily Steals** ([`FlashDeals.tsx`](src/components/FlashDeals.tsx)):
  - Real-time countdown ticker (`HH:MM:SS`), stock progression indicators, and typed fallback products.
- **Curated Showcases** ([`FeaturedSection.tsx`](src/components/FeaturedSection.tsx)):
  - High-velocity carousels for Editor's Picks, All-Time Best Sellers, and New Arrivals.
- **VIP Promotional Banner** ([`ShopCTA.tsx`](src/components/ShopCTA.tsx)):
  - High-converting mid-page banner with 1-click copy coupon code (`LAREK20`), toast notifications, and category shortcuts.
- **Verified Buyer Testimonials** ([`Testimonials.tsx`](src/components/Testimonials.tsx)):
  - Social proof section with 45,000+ verified customer reviews indicator, aggregate 4.9/5 stars, buyer spotlight card, and review feed.
- **Interactive Product Details** ([`products/[id]/page.tsx`](src/app/products/[id]/page.tsx)):
  - Product gallery with thumbnail switching and hover zoom preview ([`ProductGallery.tsx`](src/components/ProductGallery.tsx)).
  - Specifications, customer reviews with rating distributions, and shipping policies ([`ProductTabs.tsx`](src/components/ProductTabs.tsx)).
  - Real-time warehouse availability checks and interaction telemetry (`VIEW`, `ADD_TO_CART`).
- **Product Card** ([`ProductCard.tsx`](src/components/ProductCard.tsx)):
  - Discount tags, ratings, color swatches with instant image swapping, wishlist toggle, and quick view modal trigger ([`QuickViewModal.tsx`](src/components/QuickViewModal.tsx)).
- **Modern Checkout & Logistics**:
  - Responsive 2-column shipping form with live carrier quotes and saved address integration ([`ShippingForm.tsx`](src/components/ShippingForm.tsx)).
  - Cash on Delivery order placement and receipt modal ([`CodConfirmationForm.tsx`](src/components/CodConfirmationForm.tsx)).
  - Stripe card checkout with resilient fallback ([`StripePaymentForm.tsx`](src/components/StripePaymentForm.tsx)).
- **Reading Progress & Scroll Engine**:
  - Smooth inertia scrolling via Lenis, top viewport progress bar, and floating action button with circular SVG progress ring ([`ScrollToTop.tsx`](src/components/common/ScrollToTop.tsx)).
- **Global Directory Footer** ([`Footer.tsx`](src/components/Footer.tsx)):
  - Multi-column marketplace directory with newsletter voucher subscription, payment processor badges, and SSL security badges.

## Environment Variables

Copy `.env.example` to `.env`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Centralized API Gateway (Authoritative Single Entry Point for all services)
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:8090
NEXT_PUBLIC_NOTIFICATION_WS_URL=ws://localhost:8090/ws
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
