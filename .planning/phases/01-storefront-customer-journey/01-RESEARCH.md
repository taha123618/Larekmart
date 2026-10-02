# Phase 1: Storefront Customer Journey - Research

**Phase:** 01-storefront-customer-journey
**Domain:** Customer Storefront, Product Discovery, Variant Selection, Persistent Shopping Cart
**Analysis Date:** 2026-10-02

---

## User Constraints

**Locked Decisions (from ADRs & Project Context):**
- **Asynchronous Architecture:** Frontends invoke API endpoints via Ingress (`/api/v1/catalog`, `/api/v1/search`, `/api/v1/cart`); backend services communicate exclusively via Kafka (ADR-0001).
- **Authentication:** Customer identity and session authentication are governed by Clerk; guest carts merge into Clerk user carts upon login (ADR-0003).
- **Data Boundary:** Read queries hit `catalog-service` (port 8010) and `search-service` (port 8006); mutations hit `product-service` (port 8000) and `cart-service` (port 8009) (ADR-0002).

**Scope & Requirements:**
- `CLI-01`: Product discovery & catalog browsing with dynamic filtering (`?category=...&sort=...&search=...`).
- `CLI-02`: Product detail & variant selection with multi-angle gallery and reactive color/size switches.
- `CLI-03`: Persistent shopping cart with `localStorage` fallback and `cart-service` MongoDB synchronization.

---

## Standard Stack

**Storefront Core:**
- Next.js 15 (App Router) + React 19 (`apps/client/package.json`) [VERIFIED: apps/client/package.json:15-25]
- Zustand 5.0 with `persist` middleware for shopping cart (`apps/client/src/stores/cartStore.ts`) [VERIFIED: apps/client/src/stores/cartStore.ts:8-10]
- TanStack React Query 5.x for server-state caching and stale-while-revalidate data fetching (`apps/client/src/components/providers/QueryProvider.tsx`) [VERIFIED: apps/client/src/components/providers/QueryProvider.tsx:1-15]
- Lucide React for consistent icons (`apps/client/src/components/ProductInteraction.tsx`) [VERIFIED: apps/client/src/components/ProductInteraction.tsx:5-12]

**Contracts & Shared Types:**
- `@repo/types` for `ProductType`, `CartItemType`, `CartResponseType`, and Zod validation schemas [VERIFIED: packages/types/src/index.ts:1-30]

---

## Architecture Patterns

### 1. CQRS Discovery Pattern
- Storefront queries discovery catalog from `catalog-service` (`/api/v1/catalog`) which caches pre-computed views in Redis (`@repo/redis`) with 300s TTL.
- Full-text and fuzzy queries route to `search-service` (`/api/v1/search`) backed by OpenSearch.

### 2. Dual-Layer Cart Persistence Pattern
- Client-side Zustand store (`useCartStore`) provides instantaneous optimistic UI updates and survives browser reloads via `localStorage`.
- Background asynchronous debounce syncs cart state with `cart-service` (`/api/v1/cart`) using guest token header (`x-guest-id`) or Clerk Bearer token.
- On user authentication, `mergeGuestCart` reconciles local guest items with the user's authoritative MongoDB cart.

### 3. Reactive Variant Selection
- URL search parameters (`?size=M&color=black`) drive product detail page variant state, ensuring shareable and bookmarkable links.
- Image gallery reflects the primary image associated with the currently active color swatch.

---

## Don't Hand-Roll

- **Do NOT hand-roll cart persistence logic:** Use Zustand's standard `persist` middleware with `createJSONStorage(() => localStorage)`.
- **Do NOT hand-roll fuzzy text matching in Node memory:** Route search queries directly to `search-service` / OpenSearch.
- **Do NOT hand-roll session JWT verification:** Leverage `@clerk/nextjs` `auth()` and `useAuth()`.

---

## Common Pitfalls

1. **Next.js Hydration Mismatch on Cart State:**
   - *Issue:* Server renders cart count as 0, while client rehydrates from `localStorage` with items, triggering React hydration error #418.
   - *Mitigation:* Use `apps/client/src/components/providers/CartStoreHydration.tsx` or `mounted` state check before displaying cart item badges.
2. **Duplicate Items during Guest Merge:**
   - *Issue:* Adding item `SKU-A` as a guest and logging in with an existing `SKU-A` cart item can duplicate rows instead of summing quantities.
   - *Mitigation:* Ensure `mapServerItemsToCart` in `cartStore.ts` consolidates items using the composite key `${productId}:${size}:${color}` with a max quantity cap.

---

## Code Examples

### Querying Catalog with React Query
```typescript
import { useQuery } from "@tanstack/react-query";
import { getCatalogProducts } from "@/services/catalog.service";

export const useCatalogProducts = (category?: string, sort?: string) => {
  return useQuery({
    queryKey: ["catalog", "products", category, sort],
    queryFn: () => getCatalogProducts({ category, sort }),
    staleTime: 60 * 1000,
  });
};
```

---

## Validation Architecture

### Automated Verification
```bash
# Verify TypeScript strict type-checking:
pnpm --filter client check-types

# Verify storefront build:
pnpm --filter client build

# Run cart service tests:
pnpm --filter cart-service test
```

### Manual Acceptance Criteria (UAT)
1. Navigate to `/products` -> Verify responsive product grid renders with category filter and price badges.
2. Click product -> Verify variant selector updates images and enables "Add to Cart" button.
3. Add item to cart -> Reload browser -> Verify cart badge and item list persist with correct quantities.
