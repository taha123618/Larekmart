---
name: storefront-flow
description: Use when modifying the customer storefront in apps/client, including catalog browsing, cart store persistence, Stripe checkout integration, or customer order views.
---

# Client Storefront Workflows

Guidance for developing customer features in `apps/client` (Next.js 15, port 3002).

## 1. Catalog Browsing & Filtering

- Server Components fetch products from `NEXT_PUBLIC_PRODUCT_SERVICE_URL`.
- Search and category filters synchronize via URL search parameters (`searchParams`). Always `await searchParams` in Next.js 15.
- Render product cards using `ProductCard.tsx` and optimize images with `next/image`.

## 2. Cart State Management

- Cart state is managed with `zustand` in `src/stores/cartStore.ts`.
- Persisted to browser `localStorage` using Zustand's `persist` middleware.
- Only store customer selections (`id`, `title`, `price`, `quantity`, `color`, `size`, `image`).

## 3. Stripe Checkout Flow

- `ShippingForm` captures customer shipping address with `shippingFormSchema` from `@repo/types`.
- `StripePaymentForm` initializes a custom Stripe checkout session via `NEXT_PUBLIC_PAYMENT_SERVICE_URL/sessions/create-checkout-session`.
- Uses `@stripe/react-stripe-js` (`Elements`, `CheckoutProvider`).
- On successful payment completion, Stripe webhooks trigger Kafka events to create the order in `order-service`.

## 4. Verification

```bash
pnpm --filter client check-types
pnpm --filter client build
pnpm lint
```
