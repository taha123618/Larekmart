---
name: storefront-flow
description: Use when modifying the customer storefront in apps/client, including catalog browsing, cart store persistence, Stripe checkout integration, or customer order views.
---

# Client Storefront Workflows

Guidance for developing customer features in `apps/client` (Next.js 16, React 19, Turbopack, port 3002).

## 1. Storefront Architecture & Design System

- **Modern Aesthetic**: Glassmorphism, tailored Obsidian dark canvas (`bg-[#0b0f19]`, `dark:bg-slate-900/80`), inner border reflections (`dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]`), electric indigo and purple glows.
- **Dual-Theme Foundation**: `next-themes` provider with `ThemeToggleAnimated.tsx` supporting high-contrast Sun and Moon states with persistent local state and zero hydration mismatch.
- **Smooth Inertia Scrolling**: Lenis smooth scroll engine (`use-lenis.ts`) with `requestAnimationFrame` lifecycle cleanup and route change auto-reset via `usePathname()`.
- **Reading Progress & ScrollToTop**: Viewport top indicator bar (`h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500`) paired with a glassmorphic floating action button featuring SVG circular progress rings and hover halo glow (`ScrollToTop.tsx`).

## 2. Homepage Blueprint & Conversion Funnel

The homepage (`src/app/page.tsx`) implements a 14-stage high-converting marketplace layout:

1. **Header & Omnibar (`Navbar.tsx`, `SearchBar.tsx`)**: Sticky glassmorphic navbar with debounced OpenSearch autocomplete, search history pills, live notification bell, and theme switch.
2. **Hero Showcase Banner (`HeroBanner.tsx`)**: Multi-slide GSAP timeline carousel with welcome vouchers and escrow guarantees.
3. **Trust & Buyer Confidence (`TrustBadges.tsx`)**: 5-pillar buyer protection, global delivery, and free returns.
4. **Marketplace Categories Grid (`MarketplaceCategories.tsx`)**: 6-department visual discovery cards backed by `FALLBACK_CATEGORIES` to prevent SSR collapse.
5. **Flash Deals & Daily Steals (`FlashDeals.tsx`)**: Live `HH:MM:SS` countdown timer, stock depletion progress bar, and strictly typed `FALLBACK_FLASH_PRODUCTS`.
6. **Curated Editor's Picks (`FeaturedSection.tsx?type=featured`)**: Handpicked premium selections with ratings and compare-at pricing.
7. **All-Time Best Sellers (`FeaturedSection.tsx?type=best-sellers`)**: High-velocity top-rated items.
8. **ShopCTA Promotional Banner (`ShopCTA.tsx`)**: VIP Shopping Club voucher, click-to-copy coupon code (`LAREK20`), toast notifications, and category shortcuts.
9. **New Arrivals Shelf (`FeaturedSection.tsx?type=new-arrivals`)**: Fresh seasonal catalog drops.
10. **Full Catalog Discovery (`ProductList.tsx`, `Filter.tsx`, `ActiveFilters.tsx`)**: Multi-facet color/size/price filters with URL state synchronization.
11. **Verified Buyer Testimonials (`Testimonials.tsx`)**: 45k+ reviews summary, 4.9/5 stars rating, buyer spotlight, and verified purchase badges.
12. **AI Recommendation Shelves (`RecommendationSection.tsx`)**: Trending styles & recently viewed carousels powered by `recommendation-service` (:8008).
13. **Global Directory Footer (`Footer.tsx`)**: VIP newsletter coupon subscription, customer service directory, and 256-bit SSL trust badges.
14. **ScrollToTop Engine (`ScrollToTop.tsx`)**: Floating circular progress button.

## 3. Resilient SSR Fallback Strategy

To prevent blank spaces or layout shifts during cold starts or unseeded database states:

- `FeaturedSection.tsx`: Houses `FALLBACK_PRODUCTS` for `featured`, `new-arrivals`, and `best-sellers`.
- `MarketplaceCategories.tsx`: Houses `FALLBACK_CATEGORIES` for top marketplace departments.
- `FlashDeals.tsx`: Houses `FALLBACK_FLASH_PRODUCTS` conforming to `ProductType` from `@repo/types`.

## 4. Personalized AI Recommendations & Telemetry

- Powered by `recommendation-service` routed through API Gateway (`NEXT_PUBLIC_API_GATEWAY_URL` :8080):
  - Homepage: Trending, Recommended For You, and Recently Viewed shelves (`RecommendationSection.tsx`).
  - Products catalog: Category-filtered recommendations (`type="category"`).
  - Post-checkout & Orders: Post-purchase and reorder recommendations.
- Customer telemetry: `ProductInteraction.tsx` dispatches `VIEW` and `ADD_TO_CART` interactions to `POST /api/v1/interactions` and zero-throw analytics (`POST /api/v1/analytics/events`) using Clerk `userId`.

## 5. Verification Commands

```bash
pnpm --filter client check-types
pnpm --filter client build
pnpm --filter client lint
```
