# Admin Dashboard (`apps/admin`)

The administrator dashboard for Larekmart, providing catalog management, user administration, and order analytics.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack, React 19)
- **UI & Styling**: Tailwind CSS v4, shadcn/ui, Radix UI primitives, Lucide icons
- **State & Data Fetching**: TanStack Table v8, TanStack React Query v5, React Hook Form + Zod
- **Charts**: Recharts
- **Auth**: Clerk (`@clerk/nextjs`)
- **Port**: `3003`

## Key Features

- **Product Management**: List, create, and update products with multi-color image mappings and size matrices.
- **Category Management**: Create and manage hierarchical clothing categories.
- **User Management**: Admin interface proxying Clerk user management via `auth-service`.
- **Order Analytics**: 6-month order trends and order status summaries.
- **AI Recommendation Observability**: Live engine status, strategy performance metrics (CTR & conversions), and interactive recommendation tester for simulation of multi-shelf AI outputs.
- **Cache Performance**: Redis hit/miss/error rates per service and per cache, scraped live from each service's `/metrics` counters. The per-service error rate (reads that failed because Redis was unreachable) is shown next to the hit rate so services can be compared at a glance, and the cards are rank-ordered by it — worst first, with services that expose no counters last. 0% is the only healthy error rate.
- **Image Uploads**: Direct browser uploads to Cloudinary.

## Environment Variables

Copy `.env.example` to `.env`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8003
NEXT_PUBLIC_ORDER_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_PRODUCT_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ANALYTIC_SERVICE_URL=http://localhost:8004
NEXT_PUBLIC_SEARCH_SERVICE_URL=http://localhost:8006
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=http://localhost:8005
NEXT_PUBLIC_NOTIFICATION_WS_URL=ws://localhost:8005/ws
NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL=http://localhost:8008
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

## Development Commands

```bash
# Run standalone
pnpm --filter admin dev

# Type check
pnpm --filter admin check-types

# Build production bundle
pnpm --filter admin build

# Lint
pnpm --filter admin lint
```
