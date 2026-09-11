# Customer Storefront (`apps/client`)

The customer-facing storefront for Larekmart, providing catalog exploration, persistent shopping cart, and Stripe custom checkout.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack, React 19)
- **UI & Styling**: Tailwind CSS v4, Lucide icons, React Toastify
- **State Management**: Zustand (persisted with `localStorage`)
- **Forms & Validation**: React Hook Form, `@hookform/resolvers/zod`, Zod
- **Payments**: Stripe (`@stripe/react-stripe-js`, `@stripe/stripe-js`)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Port**: `3002`

## Key Features

- **Product Discovery**: Filter by category, price, size, and search term via URL search parameters.
- **Product Detail**: Color variant switching, dynamic image preview, size selection, and stock interaction.
- **Shopping Cart**: Client-side persisted cart with quantity modifications and price totals.
- **Stripe Checkout**: Integrated shipping form and Stripe payment element embedded directly in the checkout experience.
- **Order History**: Authenticated order history dashboard fetching from `order-service`.

## Environment Variables

Copy `.env.example` to `.env`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PRODUCT_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ORDER_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_PAYMENT_SERVICE_URL=http://localhost:8002
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter client dev

# Type check
pnpm --filter client check-types

# Build production bundle
pnpm --filter client build

# Lint
pnpm --filter client lint
```
