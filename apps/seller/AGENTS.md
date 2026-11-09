# AGENTS.md — apps/seller (Seller & Merchant Dashboard)

Scope: `apps/seller` only. Root rules still apply — start there.

## What this app is

Nuxt 3 (SSR + Nitro engine) Seller & Merchant Dashboard on port `:3004`. It provides full marketplace management for verified merchants and sellers:
- Legal entity vendor registration & KYB verification
- Storefront profile & branding configuration
- Multi-seller workspace switching
- Product catalog & SKU management with Zod validation
- Real-time stock ledger and inventory threshold management
- Order fulfillment lifecycle & customer shipping updates
- Financial balance, ledger earnings, and payout disbursement history
- Real-time buyer-seller customer support messaging over Socket.IO
- Omnichannel support ticketing and escalation workflows
- Staff access controls, invitations, and role permissions
- Store policies editor (Shipping, Returns, Privacy, Terms)
- Business performance KPI metrics & revenue charts

It communicates exclusively through the unified API Gateway (`http://localhost:8080` external, `http://localhost:8090` internal).

## Technology Stack

- **Framework**: Nuxt 3.17+ (Vue 3.5+, Nitro 2.13+)
- **UI & Styling**: Nuxt UI 3 + Tailwind CSS v4
- **State Management**: Pinia 2.3+ (`auth.store`, `seller.store`, `ui.store`)
- **Data Fetching**: `@tanstack/vue-query` + custom type-safe `useApi` composable
- **Tables**: `@tanstack/vue-table`
- **Charts**: ECharts + `vue-echarts`
- **Real-Time**: Socket.IO client (`socket.io-client`)
- **Forms & Validation**: VeeValidate + Zod
- **Animations**: GSAP
- **Authentication**: Clerk Vue (`@clerk/vue`) with Nitro server session route (`/api/auth/session`)

## Directory Layout

```text
apps/seller/
├── app/
│   ├── assets/css/main.css         # Tailwind v4 theme tokens, dark/light variables
│   ├── components/
│   │   ├── layout/                 # AppHeader, AppSidebar, SellerSwitcher
│   │   └── ui/                     # StatsCard, StatusBadge, DataTable, PageHeader, EmptyState, LoadingSpinner
│   ├── composables/                # useApi, useSeller, useProducts, useOrders, useSupport, useNotifications
│   ├── layouts/                    # default.vue, auth.vue, onboarding.vue
│   ├── middleware/                 # auth.ts, seller-access.ts, guest.ts
│   ├── pages/                      # 17+ views across dashboard, onboarding, products, inventory, orders, finance, chat, support, settings
│   ├── plugins/                    # vue-query, socket.io, gsap, clerk
│   ├── server/api/auth/            # Nitro routes for login.post.ts and session.get.ts
│   ├── stores/                     # auth.store, seller.store, ui.store
│   └── types/                      # TypeScript definitions (Seller, Vendor, Product, Order, Payout, etc.)
├── tests/
│   └── unit/                       # Vitest unit test suite
├── nuxt.config.ts                  # Nuxt 3 configuration & dev proxy
├── package.json                    # Workspace dependencies & scripts
├── tsconfig.json                   # Strict TypeScript compiler options
└── vitest.config.ts                # Vitest runner configuration
```

## Security & Architectural Rules

1. **No direct service-to-service calls**: Always route requests through the API Gateway (`/api/v1/*`).
2. **Perimeter token forwarding**: `useApi` attaches `Authorization: Bearer <sessionToken>` to all requests.
3. **Multi-tenancy isolation**: All store operations must scope mutations and queries to `sellerId` of the active seller.
4. **Hydration safety**: Ensure client-only state (e.g. localStorage persistence, window dimensions) runs after mount (`import.meta.client` or `onMounted`).
