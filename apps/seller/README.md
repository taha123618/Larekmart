# LarekMart Seller Dashboard (`apps/seller`)

The **LarekMart Seller Dashboard** is a multi-vendor marketplace merchant portal built with **Nuxt 3**, **Vue 3**, **TypeScript**, **Tailwind CSS v4**, **Nuxt UI**, and **TanStack Vue Query**. It delivers an Amazon Seller Central & Alibaba Seller Center grade experience for marketplace merchants, sellers, and store operators.

---

## 1. Overview & Architecture

- **Runtime**: Nuxt 3 (SSR + Nitro Server Engine)
- **Port**: `3004` (Production & Local Development)
- **State Management**: Pinia (Client State) + TanStack Vue Query v5 (Server State)
- **Authentication**: Clerk Session via `@clerk/vue` and Nitro `/api/auth/session`
- **Real-Time Communication**: Socket.IO Client 4.8 connected to API Gateway (`/socket.io` & `/api/v1/chat`)
- **Visuals & Charts**: Apache ECharts 5.6 + GSAP 3.15 animation sequences
- **Forms & Validation**: VeeValidate 4 + Zod schemas
- **Styling**: Tailwind CSS v4 design tokens with full light/dark theme support

---

## 2. Directory Structure

```text
apps/seller/
├── app/
│   ├── app.vue                  # Root application entry with Clerk & Nuxt layout
│   ├── assets/css/main.css      # Tailwind CSS tokens & theme styling
│   ├── components/              # Reusable UI & domain components
│   │   ├── layout/              # Sidebar, header, seller switcher
│   │   └── ui/                  # StatsCard, StatusBadge, DataTable, PageHeader, EmptyState
│   ├── composables/             # Typed API & query composables
│   │   ├── useApi.ts            # Type-safe $fetch with Bearer token injection
│   │   ├── useSeller.ts         # Storefront, settings, staff, policies, balances
│   │   ├── useProducts.ts       # Catalog & product management
│   │   ├── useOrders.ts         # Orders & fulfillment tracking
│   │   └── useSupport.ts        # Support tickets & chat messaging
│   ├── layouts/                 # default.vue, auth.vue, onboarding.vue
│   ├── middleware/              # auth.ts, seller-access.ts, guest.ts
│   ├── pages/                   # File-based routes
│   │   ├── dashboard/           # KPI metrics, revenue charts, recent orders
│   │   ├── onboarding/          # 4-step merchant onboarding & KYB verification
│   │   ├── products/            # Product catalog, create, edit
│   │   ├── inventory/           # Stock levels, reservations, low-stock alerts
│   │   ├── orders/              # Order listing, detail, shipment fulfillment
│   │   ├── finance/             # Earnings ledger, balance, payouts, statements
│   │   ├── chat/                # Real-time buyer-seller messaging (Socket.IO)
│   │   ├── support/             # Ticket management & inquiries
│   │   ├── settings/            # Storefront customization, staff, policies
│   │   ├── login.vue            # Clerk sign-in & development authentication
│   │   └── seller-disabled.vue  # Platform feature disable fallback
│   ├── plugins/                 # clerk, vue-query, socket.io, gsap
│   ├── stores/                  # auth, seller, ui Pinia stores
│   └── types/                   # Domain interfaces (Seller, Product, Order, etc.)
├── server/                      # Nitro backend-for-frontend server routes
├── tests/                       # Unit & integration tests (Vitest)
├── Dockerfile                   # Hardened multi-stage container
├── nuxt.config.ts               # Nuxt 3 configuration
└── package.json
```

---

## 3. Getting Started

### Local Development

1. Ensure dependencies are installed in the monorepo root:
   ```bash
   pnpm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   pnpm --filter seller dev
   ```
   Open [http://localhost:3004](http://localhost:3004) in your browser.

---

## 4. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Listening port for Nuxt application | `3004` |
| `HOST` | Binding address | `0.0.0.0` |
| `NUXT_API_GATEWAY_URL` | Server-side internal API Gateway URL | `http://localhost:8090` |
| `NUXT_PUBLIC_API_GATEWAY_URL` | Client-side public API Gateway URL | `http://localhost:8080` |
| `NUXT_PUBLIC_WS_URL` | Client-side WebSocket / Socket.IO URL | `http://localhost:8080` |
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Authentication Publishable Key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Server-Side Secret Key | `sk_test_...` |

---

## 5. Testing & Quality Gates

Run the test suite:
```bash
pnpm --filter seller test
```

Type-check:
```bash
pnpm --filter seller check-types
```

Production build:
```bash
pnpm --filter seller build
```

---

## 6. Docker Container

Build the container image locally:
```bash
docker build -f apps/seller/Dockerfile -t larekmart/seller:latest .
```

Run container:
```bash
docker run -p 3004:3004 --env-file apps/seller/.env larekmart/seller:latest
```
