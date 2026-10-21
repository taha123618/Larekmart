# Larekmart

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.x-blue.svg)](packages/typescript-config)
[![Turborepo](https://img.shields.io/badge/Turborepo-v2.x-ef4444.svg)](https://turbo.build)
[![Next.js](<https://img.shields.io/badge/Next.js-15%20(App%20Router)-black.svg>)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Orchestration-2496ED.svg)](docs/DOCKER.md)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Production%20Ready-326CE5.svg)](infrastructure/kubernetes)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**A production-grade, distributed microservices e-commerce platform built for high-throughput marketplace scale (like Amazon, AliExpress, and Daraz).**

[Features](#system-architecture) • [Storefront Tour](#-storefront-visual-showcase) • [Quick Start](#quick-start) • [Architecture](#system-architecture) • [Documentation](#documentation-index) • [Contributing](CONTRIBUTING.md)

</div>

---

**Larekmart** is a production-grade microservices e-commerce platform designed for multi-tenant marketplace scale. It pairs a customer storefront and an admin management dashboard with a **centralized Fastify API Gateway** and **twenty backend services** communicating **asynchronously over Apache Kafka** and persisting data via a **polyglot architecture** (PostgreSQL for products, inventory, catalog, shipping, users, media, analytics, notifications, reviews, wishlists, and promotions; MongoDB for orders and carts; MySQL for tax rules, calculations, jurisdictions, and return/refund management).

The repository is organized as a **pnpm 9 + Turborepo** monorepo: Next.js frontends, polyglot Node, Go, and Python services, and shared internal packages managed with unified tooling, strict TypeScript typing, and shared configurations.

---

## 🖼️ Storefront Visual Showcase

<div align="center">

> **A modern, responsive, high-converting customer shopping experience built with Next.js 16 (App Router), Tailwind CSS v4, Zustand, Framer Motion, and Stripe.**

| [🏠 Homepage Tour](#-1-storefront-homepage-walkthrough-8-slides) | [🛍️ Product Detail](#-2-product-discovery--shopping-cart) | [🛒 Smart Cart](#-2-product-discovery--shopping-cart) | [💳 4-Step Checkout Flow](#-3-streamlined-4-step-checkout-flow) | [🚚 Order Tracking](#-4-post-purchase--real-time-order-tracking) |
| :--------------------------------------------------------------: | :-------------------------------------------------------: | :---------------------------------------------------: | :-------------------------------------------------------------: | :--------------------------------------------------------------: |

<br/>

<p align="center">
  <a href="./public/images/client/home/home-01.png">
    <img src="./public/images/client/home/home-01.png" alt="Larekmart Customer Storefront Homepage Preview" width="100%" />
  </a>
  <br/>
  <em>✨ High-converting customer storefront featuring responsive category discovery, dynamic hero carousels, and flash deals.</em>
</p>

</div>

<br/>

### 🏠 1. Storefront Homepage Walkthrough (8 Slides)

<details open>
<summary><b>▶ Click to expand / collapse the Homepage Walkthrough (8 sections)</b></summary>
<br/>

<table>
  <tr>
    <td align="center" width="50%">
      <b>Slide 1/8: Hero Showcase & Dynamic Categories</b><br/>
      <sub>Interactive hero banner with promotional carousels, instant search bar, and marketplace navigation.</sub><br/><br/>
      <a href="./public/images/client/home/home-01.png">
        <img src="./public/images/client/home/home-01.png" alt="Slide 1 - Storefront Hero & Top Categories" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Slide 2/8: Flash Deals & Limited-Time Offers</b><br/>
      <sub>Real-time countdown counters, dynamic percentage-off badges, and quick-add actions.</sub><br/><br/>
      <a href="./public/images/client/home/home-02.png">
        <img src="./public/images/client/home/home-02.png" alt="Slide 2 - Flash Sales & Deal Counters" width="100%" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Slide 3/8: Popular Categories & Trending Grid</b><br/>
      <sub>Curated category tiles, trending product grids, and catalog discovery entrypoints.</sub><br/><br/>
      <a href="./public/images/client/home/home-03.png">
        <img src="./public/images/client/home/home-03.png" alt="Slide 3 - Popular Categories & Trending Grid" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Slide 4/8: Promotional Campaigns & Spotlight Banners</b><br/>
      <sub>Seasonal promotional highlights, coupon announcements, and partner campaigns.</sub><br/><br/>
      <a href="./public/images/client/home/home-04.png">
        <img src="./public/images/client/home/home-04.png" alt="Slide 4 - Promotional Campaigns & Marketing Highlights" width="100%" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Slide 5/8: Personalized Recommendations & Best Sellers</b><br/>
      <sub>Recommendation engine suggestions, verified customer review ratings, and price tags.</sub><br/><br/>
      <a href="./public/images/client/home/home-05.png">
        <img src="./public/images/client/home/home-05.png" alt="Slide 5 - Recommended For You & Best Sellers" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Slide 6/8: Official Brands & Curated Stores</b><br/>
      <sub>Marketplace brand spotlights, seller storefront links, and seasonal lookbooks.</sub><br/><br/>
      <a href="./public/images/client/home/home-06.png">
        <img src="./public/images/client/home/home-06.png" alt="Slide 6 - Official Brands & Curated Collections" width="100%" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Slide 7/8: Value Propositions & Newsletter</b><br/>
      <sub>Buyer protection guarantees, global shipping terms, 24/7 support & VIP membership signup.</sub><br/><br/>
      <a href="./public/images/client/home/home-07.png">
        <img src="./public/images/client/home/home-07.png" alt="Slide 7 - Buyer Protection & Newsletter Subscription" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Slide 8/8: Global Footer & Marketplace Directory</b><br/>
      <sub>Payment provider badges, legal/security policies, currency selector, and site navigation.</sub><br/><br/>
      <a href="./public/images/client/home/home-08.png">
        <img src="./public/images/client/home/home-08.png" alt="Slide 8 - Storefront Footer & Marketplace Directory" width="100%" />
      </a>
    </td>
  </tr>
</table>

</details>

<br/>

### 🛍️ 2. Product Discovery & Shopping Cart

<table>
  <tr>
    <td align="center" width="50%">
      <b>📦 Rich Product Detail Experience</b><br/>
      <sub>Multi-angle image gallery, color/variant selectors, real-time inventory checks, verified purchase reviews, and wishlist alerts.</sub><br/><br/>
      <a href="./public/images/client/product-detail.png">
        <img src="./public/images/client/product-detail.png" alt="Product Detail Page" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>🛒 Authoritative Cart & Real-Time Estimates</b><br/>
      <sub>MongoDB-backed persistent cart, promotional coupon discounts, real-time tax estimation, and estimated shipping fees.</sub><br/><br/>
      <a href="./public/images/client/cart.png">
        <img src="./public/images/client/cart.png" alt="Shopping Cart Page" width="100%" />
      </a>
    </td>
  </tr>
</table>

<br/>

### 💳 3. Streamlined 4-Step Checkout Flow

<details open>
<summary><b>▶ Click to expand / collapse the 4-Step Checkout Flow</b></summary>
<br/>

<table>
  <tr>
    <td align="center" width="50%">
      <b>Step 1: Shipping Address & Recipient Details</b><br/>
      <sub>Saved user addresses, interactive address validation, and delivery instructions.</sub><br/><br/>
      <a href="./public/images/client/checkout-01.png">
        <img src="./public/images/client/checkout-01.png" alt="Checkout Step 1 - Shipping Address" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Step 2: Shipping Methods & Live Carrier Rates</b><br/>
      <sub>Multi-carrier delivery estimates (Standard, Express, Overnight) and carrier selection.</sub><br/><br/>
      <a href="./public/images/client/checkout-02.png">
        <img src="./public/images/client/checkout-02.png" alt="Checkout Step 2 - Shipping Method" width="100%" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Step 3: Secure Payment Methods</b><br/>
      <sub>Stripe payment elements, credit/debit card processing, Klarna installments, and Cash on Delivery (COD).</sub><br/><br/>
      <a href="./public/images/client/checkout-03.png">
        <img src="./public/images/client/checkout-03.png" alt="Checkout Step 3 - Payment Method" width="100%" />
      </a>
    </td>
    <td align="center" width="50%">
      <b>Step 4: Final Review & Order Placement</b><br/>
      <sub>Transparent itemized totals, tax audit quotes, shipping insurance options, and one-click order confirmation.</sub><br/><br/>
      <a href="./public/images/client/checkout-04.png">
        <img src="./public/images/client/checkout-04.png" alt="Checkout Step 4 - Order Review" width="100%" />
      </a>
    </td>
  </tr>
</table>

</details>

<br/>

### 🚚 4. Post-Purchase & Real-Time Order Tracking

<table>
  <tr>
    <td align="center" width="100%">
      <b>📋 Order Confirmation & Live Checkpoint Tracking</b><br/>
      <sub>Instant invoice generation, order lifecycle states (Created ➔ Confirmed ➔ Dispatched ➔ Delivered), carrier tracking checkpoint timeline, and self-service return request initiator.</sub><br/><br/>
      <a href="./public/images/client/order.png">
        <img src="./public/images/client/order.png" alt="Order Confirmation and Tracking Page" width="90%" />
      </a>
    </td>
  </tr>
</table>

---

## System Architecture

```
                         ┌───────────────────────┐
                         │        Clerk          │  auth + session claims (role: user|admin)
                         └───────────┬───────────┘
                                     │ Bearer JWT
          ┌──────────────────────────┴──────────────────────────┐
          │                                                     │
   ┌──────▼───────┐                                      ┌──────▼───────┐
   │   client     │                                      │    admin     │
   │  Next.js 16  │                                      │  Next.js 15  │
   │   :3002      │                                      │   :3003      │
   └──────┬───────┘                                      └──────┬───────┘
          │                                                     │
          │                   HTTPS / REST                      │
          └──────────────────────────┬──────────────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │         api-gateway         │  Fastify 5 (:8080 / :8090)
                      │ • Clerk session & headers   │  Reverse proxy, rate limiting,
                      │ • Internal secret signing   │  circuit breaker, retries,
                      │ • Home agg (/api/v1/home)   │  and request correlation
                      └──────────────┬──────────────┘
                                     │ x-user-id, x-user-role, x-internal-secret
      ┌──────────────────────────────┼──────────────────────────────┬──────────────────────────────┐
      │                              │                              │                              │
┌─────▼──────────┐            ┌──────▼───────┐               ┌──────▼───────┐               ┌──────▼───────┐
│ product-service│            │ auth-service │               │notification- │               │payment-service│
│ Express :8000  │            │ Express :8003│               │   service    │               │  Hono :8002  │
│ Prisma/Postgres│            │ Clerk proxy  │               │ Go (Chi)     │               │  Stripe      │
└─────┬──────────┘            └──────┬───────┘               │ :8005        │               └──────┬───────┘
      │ product.*                    │ user.created          └──────▲───────┘                      │ payment.*
      │                              │                              │                              │
      ▼                              ▼                              │                              ▼
┌───────────────┐             ┌──────────────┐                      │                       ┌──────────────┐
│ Kafka cluster │◄────────────┤email-service │◄─────────────────────┼───────────────────────┤order-service │
│  (3 brokers)  │             │ (worker)     │                      │                       │Fastify :8001 │
└───────┬───────┘             └──────────────┘                      │                       │MongoDB       │
        │                                                           │                       └──────────────┘
        │ all domain event streams                                  │
        ▼                                                           │
┌───────────────────────┐                                           │
│   analytic-service    │                                           │
│   Express :8004       │                                           │
│   PostgreSQL (pg)     │                                           │
└───────────────────────┘                                           │
        ▲                                                           │
        └───────────────────────────────────────────────────────────┘
```

> Cross-service communication is strictly asynchronous through Kafka events. Backend services never call each other over HTTP. Public traffic enters through `api-gateway`, which enforces rate limits, authenticates sessions, strips spoofed headers, and injects verified identity headers signed with `x-internal-secret`. See [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md) for full topic contracts and [`docs/SECURITY.md`](docs/SECURITY.md) for security policies.

---

## Monorepo Layout

```text
.
├── apps/
│   ├── admin/                # Next.js 15 admin dashboard (:3003)
│   ├── client/               # Next.js 16 customer storefront (:3002)
│   ├── api-gateway/          # Fastify 5 API Gateway reverse proxy & aggregator (:8080 / :8090)
│   ├── auth-service/         # Express 5 + Clerk user management (:8003)
│   ├── order-service/        # Fastify 5 + MongoDB orders & analytics (:8001)
│   ├── payment-service/      # Hono + Stripe custom checkout & webhooks (:8002)
│   ├── product-service/      # Express 5 + Prisma catalog (:8000)
│   ├── email-service/        # Headless Kafka worker -> transactional email
│   ├── analytic-service/     # Express 5 + PostgreSQL analytics API & Kafka worker (:8004)
│   ├── notification-service/ # Go (Chi) + PostgreSQL + Redis + WebSockets notification orchestration (:8005)
│   ├── search-service/       # Fastify + OpenSearch + Redis + Kafka search and indexing (:8006)
│   ├── inventory-service/    # Hono + PostgreSQL + Redis + Kafka inventory API (:8007)
│   ├── recommendation-service/ # Python 3.12+ (FastAPI) + pgvector + Redis + Celery recommendation engine (:8008)
│   ├── cart-service/          # Express 5 + MongoDB + Redis + Kafka cart management & pricing estimates (:8009)
│   ├── catalog-service/       # Fastify 5 + Prisma read-model catalog discovery, brands & collections (:8010)
│   ├── shipping-service/      # Koa + PostgreSQL + carrier adapters shipment lifecycle & tracking (:8011)
│   ├── user-service/          # Fastify 5 + Prisma customer profiles, addresses & preferences (:8012)
│   ├── media-service/         # Hono + S3/MinIO + Drizzle media uploads, variants & workers (:8013)
│   ├── review-service/        # Fastify 5 + PostgreSQL + Drizzle + Redis reviews, ratings, moderation & reputation (:8014)
│   ├── wishlist-service/      # Fastify 5 + PostgreSQL + Drizzle + Redis wishlists, guest migration & price/stock alerts (:8015)
│   ├── promotion-service/     # Hono 4 + PostgreSQL + Drizzle + Redis promotions, coupons, budget holds & discounts (:8016)
│   ├── tax-service/           # Fastify 5 + MySQL + Drizzle + Redis tax rules, calculations, exemptions & quotes (:8017)
│   └── return-service/        # Koa 2 + MySQL + Drizzle + Redis return requests, eligibility, inspection & refund coordination (:8018)
├── packages/
│   ├── kafka/                # @repo/kafka    — kafkajs client wrapper + docker-compose
│   ├── redis/                # @repo/redis    — ioredis client, cache helpers, rate limiter + docker-compose
│   ├── opensearch/           # @repo/opensearch — OpenSearch client, mappings, query and indexing helpers
│   ├── types/                # @repo/types    — shared types, Zod schemas, event contracts
│   ├── monitoring/           # @repo/monitoring — structured logging, health checks, metrics & telemetry
│   ├── product-db/           # @repo/product-db — Prisma client & schema (PostgreSQL)
│   ├── inventory-db/         # @repo/inventory-db — Prisma inventory schema, reservations & ledger (PostgreSQL)
│   ├── order-db/             # @repo/order-db  — Mongoose connection & Order model (MongoDB)
│   ├── cart-db/              # @repo/cart-db   — Mongoose connection & Cart models (MongoDB)
│   ├── catalog-db/           # @repo/catalog-db — Prisma catalog read-model schema (PostgreSQL)
│   ├── shipping-db/          # @repo/shipping-db — Prisma shipments, tracking events & labels (PostgreSQL)
│   ├── user-db/              # @repo/user-db   — Prisma profiles, addresses & preferences (PostgreSQL)
│   ├── eslint-config/        # @repo/eslint-config — shared ESLint flat configs
│   └── typescript-config/    # @repo/typescript-config — shared tsconfig bases
├── docs/                     # Architecture, dependencies, conventions, testing, ADRs
├── .agents/skills/           # AI coding agent root skills
├── turbo.json                # Turborepo task pipeline
└── pnpm-workspace.yaml       # Workspace package definitions
```

---

## Applications

| Application                  | Technology Stack                                                                      | Port   | Purpose & Responsibilities                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`client`**                 | Next.js 16, React 19, Tailwind v4, Zustand, Framer Motion, GSAP, Stripe, Clerk        | `3002` | Customer storefront: catalog search/filter, persistent cart, Framer Motion drawers/modals, GSAP banners, Stripe checkout, order history.                                                        |
| **`admin`**                  | Next.js 15, React 19, Tailwind v4, shadcn/ui, TanStack Table & Query, Recharts, Clerk | `3003` | Admin dashboard: catalog management, user administration proxy, order trends, and real-time KPI cards & charts from `analytic-service`.                                                         |
| **`api-gateway`**            | Fastify 5, `@fastify/http-proxy`, Opossum, Redis, Clerk                               | `8080` | Unified public reverse proxy, header sanitization, Clerk JWT validation, Redis rate limiting, circuit breaker, and `/api/v1/home` aggregation.                                                  |
| **`product-service`**        | Express 5, Prisma, PostgreSQL, Kafka                                                  | `8000` | Product and category catalog CRUD; publishes `product.created` and `product.deleted`.                                                                                                           |
| **`order-service`**          | Fastify 5, Mongoose, MongoDB, Kafka                                                   | `8001` | Consumes `payment.successful`, persists orders, serves user orders and 6-month sales analytics; publishes `order.created`.                                                                      |
| **`payment-service`**        | Hono, Stripe SDK, Kafka                                                               | `8002` | Creates Stripe checkout sessions, verifies Stripe webhooks, mirrors catalog products to Stripe; publishes `payment.successful`.                                                                 |
| **`auth-service`**           | Express 5, Clerk Backend SDK, Kafka                                                   | `8003` | Admin user management proxying Clerk backend; publishes `user.created`.                                                                                                                         |
| **`email-service`**          | Node.js (ESM), Nodemailer (Gmail OAuth2), Kafka                                       | —      | Headless worker consuming `user.created` (welcome) and `order.created` (order receipts).                                                                                                        |
| **`analytic-service`**       | Express 5, Node.js (ESM), PostgreSQL (`pg`), Kafka                                    | `8004` | Consumes all event streams, updates live KPI counters, persists audit logs & daily rollups to PostgreSQL, and serves REST analytics to `admin`.                                                 |
| **`notification-service`**   | Go 1.22 (Chi), PostgreSQL, Redis, WebSockets, Kafka, OpenTelemetry                    | `8005` | Multi-channel notification orchestration (Email, SMS, Push, In-App), worker pools, Redis deduplication, and real-time WebSocket hub.                                                            |
| **`search-service`**         | Fastify 5, OpenSearch, Redis, Kafka, Clerk                                            | `8006` | Product search, autocomplete, faceting, rate limiting, Kafka-driven indexing, and zero-downtime reindexing.                                                                                     |
| **`inventory-service`**      | Hono 4, Prisma, PostgreSQL, Redis, Kafka, Clerk                                       | `8007` | Stock availability, atomic reservations, warehouse inventory, restocks, adjustments, and inventory events.                                                                                      |
| **`recommendation-service`** | Python 3.12+ (FastAPI), SQLAlchemy async, PostgreSQL, pgvector, Redis, Celery, Kafka  | `8008` | Hybrid candidate generation (collaborative & content filtering, embeddings, trending velocity), interactive tester, and behavioral telemetry.                                                   |
| **`cart-service`**           | Express 5, Mongoose, MongoDB, Redis, Kafka, Clerk                                     | `8009` | Authoritative cart persistence, guest-to-user merge, coupon management, estimated totals, and TTL expiration worker.                                                                            |
| **`catalog-service`**        | Fastify 5, Prisma, PostgreSQL, Redis, Kafka, Clerk                                    | `8010` | Read-optimized product discovery: categories, brands, collections, and storefront listing projections.                                                                                          |
| **`shipping-service`**       | Koa (Node.js), Prisma, PostgreSQL, Redis, Kafka, Clerk                                | `8011` | Shipment lifecycle, rate quotes, carrier adapters (TCS/Leopards/DHL/FedEx), tracking, and labels.                                                                                               |
| **`user-service`**           | Fastify 5, Prisma, PostgreSQL, Redis, Kafka, Clerk                                    | `8012` | Customer profiles, saved addresses, preferences, and account-domain events.                                                                                                                     |
| **`media-service`**          | Hono 4, Drizzle, PostgreSQL, S3/MinIO, Redis, Kafka, Clerk, Sharp                     | `8013` | Presigned direct uploads, media metadata, image variants, lifecycle events, and processing/cleanup workers.                                                                                     |
| **`review-service`**         | Fastify 5, Drizzle, PostgreSQL, Redis, Kafka, Clerk                                   | `8014` | Customer reviews, ratings, verified purchase gating, moderation queue, helpful voting, seller replies, and rating summary projections.                                                          |
| **`wishlist-service`**       | Fastify 5, Drizzle, PostgreSQL, Redis, Kafka, Clerk                                   | `8015` | Customer wishlists, multiple lists, guest-to-user migration, unguessable sharing tokens, price-drop and restock notification alerts.                                                            |
| **`promotion-service`**      | Hono 4, Drizzle, PostgreSQL, Redis, Kafka, Clerk                                      | `8016` | Centralized promotions, campaigns, coupons, discount eligibility, budgets, checkout reservations, and redemptions.                                                                              |
| **`tax-service`**            | Fastify 5, Drizzle, MySQL, Redis, Kafka, Clerk                                        | `8017` | Jurisdiction-aware tax calculations, versioned tax rules, customer exemptions, checkout quotes, auditable snapshots, and provider adapters.                                                     |
| **`return-service`**         | Koa 2, Drizzle, MySQL, Redis, Kafka, Clerk                                            | `8018` | Complete return & refund lifecycle: eligibility checks, partial-quantity returns, evidence attachments, inspection dispositions, return-shipment tracking, and Stripe refund SAGA coordination. |

---

## Shared Packages

| Package                       | Purpose & Exports                                                                                            | Primary Consumers                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **`@repo/kafka`**             | Kafka client wrapper (`createKafkaClient`, `createProducer`, `createConsumer`) and local 3-broker compose.   | All backend services                                |
| **`@repo/types`**             | Central contract package: API domain types, Kafka payload interfaces, and shared Zod form schemas.           | All applications & packages                         |
| **`@repo/monitoring`**        | Framework-agnostic structured logging, health checks, metrics, and performance telemetry.                    | All applications & packages                         |
| **`@repo/redis`**             | Redis client factory, namespaced key builder, typed cache helpers, namespace invalidation, and rate limiter. | Product, order, search, analytic, and cart services |
| **`@repo/opensearch`**        | OpenSearch client factory, product mappings, query builders, indexing, search, and reindex helpers.          | Product and search services                         |
| **`@repo/product-db`**        | PostgreSQL catalog persistence via Prisma schema and generated `prisma` client singleton.                    | `product-service`, `@repo/types` (type-only)        |
| **`@repo/inventory-db`**      | PostgreSQL inventory persistence via Prisma, atomic reservations, and an inventory movement ledger.          | `inventory-service`                                 |
| **`@repo/order-db`**          | MongoDB persistence via Mongoose `Order` model and connection helper.                                        | `order-service`, `@repo/types` (type-only)          |
| **`@repo/cart-db`**           | MongoDB persistence via Mongoose `Cart` and `ProcessedEvent` models and connection helper.                   | `cart-service`, `@repo/types` (type-only)           |
| **`@repo/catalog-db`**        | PostgreSQL catalog read-model persistence via Prisma schema and generated client.                            | `catalog-service`                                   |
| **`@repo/shipping-db`**       | PostgreSQL shipping persistence via Prisma: shipments, packages, tracking events, labels.                    | `shipping-service`                                  |
| **`@repo/user-db`**           | PostgreSQL user-domain persistence via Prisma: profiles, addresses, preferences, settings.                   | `user-service`                                      |
| **`@repo/eslint-config`**     | Shared ESLint flat configurations (`base`, `next-js`, `react-internal`).                                     | `admin`, `client`                                   |
| **`@repo/typescript-config`** | Shared strict TypeScript compiler configurations (`base.json`, `nextjs.json`, `react-library.json`).         | All 36 workspaces                                   |

---

## Technology Stack

- **Runtime & Language**: Node.js ≥ 18, TypeScript 5.9 (Strict mode enabled across all packages), ESM (`"type": "module"`)
- **Monorepo Tooling**: pnpm 9 workspaces, Turborepo 2
- **Frontend Frameworks**: Next.js 15 (App Router, Turbopack, React Server Components), React 19
- **UI & Design System**: Tailwind CSS v4, shadcn/ui, Radix UI primitives, Lucide React, Recharts
- **State Management & Forms**: Zustand (persisted), TanStack React Query v5, TanStack Table v8, React Hook Form + Zod
- **Backend & Gateway Frameworks**: Fastify 5 (`@fastify/http-proxy`, `@fastify/helmet`, Opossum circuit breaker), Express 5, Hono 4, Koa, Go 1.22 (Chi), Python 3.12+ (FastAPI)
- **Databases & Persistence**: PostgreSQL (via Prisma ORM, Drizzle ORM & pg), MongoDB (via Mongoose), MySQL 8.0 (via Drizzle ORM)
- **Message Broker**: Apache Kafka (KafkaJS, 3-broker cluster with ZooKeeper and Kafka UI)
- **Authentication**: Clerk (`@clerk/nextjs`, `@clerk/express`, `@clerk/fastify`, `@hono/clerk-auth`)
- **Payments**: Stripe (Custom Checkout Element + Webhooks)

---

## Development Workflow

### 1. Prerequisites

- **Node.js**: ≥ 18
- **pnpm**: 9.0.0 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Docker**: For running the local Kafka cluster and Redis
- **Redis**: Local or containerized on port `6379` (cache for product, order, search, and analytic services)
- **OpenSearch**: Local or containerized on port `9200` (search index owned by search-service)
- **PostgreSQL**: Local or containerized on port `5432`
- **MongoDB**: Local or containerized on port `27017`
- **MySQL**: Local or containerized on port `3306` (tax compliance & snapshots owned by `tax-service`; return requests, RMA tracking, inspections & refunds owned by `return-service`)

### 2. Installation & Setup

```bash
# ==============================================================================
# Option A: Full Docker Compose Environment (Recommended)
# ==============================================================================
# Spins up backing databases (Postgres with pgvector, MongoDB replica set, MySQL 8.0, Redis,
# Kafka KRaft broker, OpenSearch), Kafka UI, all 20 backend services, and both Next.js frontends:
docker compose up -d --build

# View logs:
docker compose logs -f

# Stop environment (preserving data volumes):
docker compose down

# ==============================================================================
# Option B: Local Monorepo Dev (Backing Infrastructure in Docker)
# ==============================================================================
# 1. Automated monorepo setup (dependencies, .env files, AI skills sync)
pnpm run setup

# 2. Start backing infrastructure in Docker (PostgreSQL, MongoDB, Mongo-Express, MySQL, Redis, Kafka, OpenSearch, Kafka UI)
docker compose up -d postgres mongo mongo-express mysql redis kafka opensearch kafka-ui

# 3. Generate Prisma Clients & apply database migrations
pnpm --filter @repo/product-db db:generate
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/catalog-db db:generate
pnpm --filter @repo/shipping-db db:generate
pnpm --filter media-service db:migrate
pnpm --filter review-service db:migrate
pnpm --filter wishlist-service db:migrate
pnpm --filter promotion-service db:migrate
pnpm --filter tax-service db:migrate
pnpm --filter return-service db:migrate

# 4. Start all workspaces concurrently in development mode
pnpm dev
```

### 3. Core Commands

| Task                | Command                                                     | Description                                                                         |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Development**     | `pnpm dev`                                                  | Run all applications and services concurrently via Turborepo                        |
| **Scoped Dev**      | `pnpm --filter <workspace> dev`                             | Run a specific application or service (e.g. `notification-service`)                 |
| **Redis Docker**    | `docker compose -f packages/redis/docker-compose.yml up -d` | Run local Redis for the service caches and rate limiting                            |
| **Type Check**      | `pnpm check-types`                                          | Run type checking (`tsc` / `go vet` / `pytest`) across all 36 workspaces            |
| **Lint**            | `pnpm lint`                                                 | Run ESLint flat checks on `admin` and `client`                                      |
| **Format**          | `pnpm format`                                               | Run Prettier across all TypeScript, TSX, and Markdown files                         |
| **Build**           | `pnpm build`                                                | Run configured builds for the Next.js apps, Node services, packages, and Go service |
| **Prisma Generate** | `pnpm --filter @repo/product-db db:generate`                | Regenerate Prisma client                                                            |
| **Prisma Migrate**  | `pnpm --filter @repo/product-db db:migrate`                 | Create and apply development migrations                                             |

### 4. Running Kubernetes Staging & Development Environments

The repository includes declarative Kustomize overlays in `infrastructure/kubernetes/overlays/` (`development`, `staging`, `production`). Applying these overlays requires an active Kubernetes cluster context configured in `~/.kube/config`.

#### A. Local Cluster Setup with Minikube (Recommended)

```bash
# 1. Start a local cluster using the Docker driver
minikube start --driver=docker

# 2. Enable the NGINX Ingress controller addon
minikube addons enable ingress

# 3. Verify the cluster is active
kubectl cluster-info
```

#### B. Local Cluster Setup with Docker Desktop

1. Open **Docker Desktop Settings** → **Kubernetes**.
2. Check **"Enable Kubernetes"** and click **Apply & Restart**.
3. Verify your context:
   ```bash
   kubectl config use-context docker-desktop
   kubectl cluster-info
   ```

#### C. Remote Cloud Cluster (EKS / GKE / AKS)

Configure your local kubeconfig to point to your cloud staging or dev cluster:

```bash
# AWS EKS:
aws eks update-kubeconfig --name larekmart-staging --region <region>

# Google Cloud GKE:
gcloud container clusters get-credentials larekmart-staging --zone <zone>
```

#### D. Deploying Overlays & Verifying Ingress Traffic

```bash
# Deploy staging overlay:
pnpm run k8s:staging

# Deploy development overlay:
pnpm run k8s:dev

# Validate manifests offline without an active cluster:
pnpm run k8s:validate

# Verify deployment rollout & pods:
kubectl get pods,svc,ingress -n larekmart-staging

# Run the 20-point staging ingress & route verification suite:
bun run test:staging:traffic

# Or point the traffic suite to a custom/remote host:
bash scripts/verify-staging-traffic.sh https://staging.larekmart.com
```

For complete ingress routing architecture, network policies, and horizontal autoscaling details, see [`infrastructure/kubernetes/README.md`](infrastructure/kubernetes/README.md).

---

## AI-Assisted Development System

Larekmart includes a comprehensive, hierarchical AI coding-agent operating system designed for tools like Antigravity, Claude Code, GitHub Copilot, and Cursor.

```text
Root Rules (AGENTS.md)
    ↓
Global Skills (.agents/skills/*)
    ↓
Workspace Rules (apps/*/AGENTS.md, packages/*/AGENTS.md)
    ↓
Workspace Skills (<workspace>/.agents/skills/*)
```

- **Root Instructions**: [`AGENTS.md`](./AGENTS.md) defines monorepo golden rules, the 3-stage agent lifecycle (_Before_, _While_, _After Making Changes_), and repository boundaries.
- **Global Skills (`.agents/skills/`)**:
  - `root-architecture`: Monorepo architecture map and service topology.
  - `coding-standards`: TypeScript strict conventions, ESM rules, and error response standards.
  - `debugging`: Playbooks for Kafka topic inspection, Clerk authentication, database connectivity, and SSR hydration.
  - `monorepo-development`: Workflows for pnpm workspaces, dependency management, and Turborepo pipelines.
  - `security`: Auth guards, RBAC, Stripe webhook signature validation, and secret handling.
    - `testing`: Monorepo verification guidelines, Go test coverage, and opt-in Redis integration checks.
  - `code-review`: Checklist for boundary validation, event contracts, and quality verification.
  - `documentation`: Scoped documentation rules and ADR maintenance.
  - `docker-devops`: Docker, Compose, Kubernetes, CI/CD, and production operations.
  - `security-audit`: Vulnerability review workflow for codebases, APIs, and services.
  - `monitoring`: Telemetry, structured logging, health checks, and metrics via `@repo/monitoring`.
- **Workspace-specific rules & skills**: Each app and package has a scoped `AGENTS.md`. Specialized workspace skills live in `<workspace>/.agents/skills/` (e.g. `tax-engine` in `apps/tax-service`, `review-lifecycle` in `apps/review-service`). Canonical root skills are mirrored across `.cursor/`, `.claude/`, `.gemini/`, and `.github/` via `pnpm run skills:sync`.

---

## Documentation Index

| Document                                                                                                                   | Purpose & Scope                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`docs/BRD.md`](docs/BRD.md)                                                                                               | Business Requirement Document: goals, ROI, conversion KPIs, financial compliance       |
| [`docs/PRD.md`](docs/PRD.md)                                                                                               | Product Requirement Document: user personas, journeys, accessibility, MVP roadmap      |
| [`docs/FRD.md`](docs/FRD.md)                                                                                               | Functional Requirement Document: API specs, state machines, Kafka event contracts      |
| [`docs/TRD.md`](docs/TRD.md)                                                                                               | Technical Requirement Document: topology, port matrix, SLAs, strict TS standards       |
| [`docs/MRD.md`](docs/MRD.md)                                                                                               | Model Requirement Document: DB schemas (Postgres, Mongo), @repo/types, ML models       |
| [`docs/DATA-STRATEGY.md`](docs/DATA-STRATEGY.md)                                                                           | Data Strategy Document: polyglot governance, event consistency, PII protection         |
| [`docs/AI-EVALUATION-FRAMEWORK.md`](docs/AI-EVALUATION-FRAMEWORK.md)                                                       | AI Evaluation Framework: agent scoring rubrics, benchmark suites, verification steps   |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                                             | High-level system architecture, service responsibilities, and request flows            |
| [`docs/API.md`](docs/API.md)                                                                                               | Comprehensive API endpoint registry across all backend services                        |
| [`docs/EVENT-DRIVEN-ARCHITECTURE.md`](docs/EVENT-DRIVEN-ARCHITECTURE.md)                                                   | Kafka topic registry, payload contracts, and event schemas                             |
| [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md)                                                                             | Dependency graph, boundaries, and import constraints                                   |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                                                                               | Local development setup, port registry, and environment variables matrix               |
| [`docs/RULES.md`](docs/RULES.md)                                                                                           | Monorepo engineering rules, dependency boundaries, event envelopes, and security gates |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                                                                         | UI/UX design system, design tokens, responsive breakpoints, component specs & motion   |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)                                                                               | Coding style, naming patterns, and design principles                                   |
| [`docs/SECURITY.md`](docs/SECURITY.md)                                                                                     | Security policies, Clerk authorization, and Stripe webhook verification                |
| [`docs/TESTING.md`](docs/TESTING.md)                                                                                       | Testing strategy, verification commands, and automated test setup                      |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)                                                                             | Contribution standards, git workflow, and definition of done                           |
| [`docs/adr/README.md`](docs/adr/README.md)                                                                                 | Architecture Decision Records (ADRs)                                                   |
| [`docs/DOCKER.md`](docs/DOCKER.md)                                                                                         | Complete Docker operations manual, reverse-proxy ingress & network topology            |
| [`docs/ROOTPRINT.md`](docs/ROOTPRINT.md)                                                                                   | Rootprint, MinIO S3, and Quickwit distributed log analytics guide                      |
| [`docs/comparisons/README.md`](docs/comparisons/README.md)                                                                 | Infrastructure decisions: DevOps stack, Ingress routers, and Observability             |
| [`docs/comparisons/DEVOPS-INFRASTRUCTURE-STACK-COMPARISON.md`](docs/comparisons/DEVOPS-INFRASTRUCTURE-STACK-COMPARISON.md) | Full-stack evaluation: Docker vs. K8s vs. GitHub Actions vs. Ingress                   |
| [`docs/comparisons/REVERSE-PROXY-INGRESS-COMPARISON.md`](docs/comparisons/REVERSE-PROXY-INGRESS-COMPARISON.md)             | Reverse proxy evaluation: Caddy vs. NGINX vs. Traefik                                  |
| [`docs/comparisons/OBSERVABILITY-STACK-COMPARISON.md`](docs/comparisons/OBSERVABILITY-STACK-COMPARISON.md)                 | Observability evaluation: Dozzle vs. Rootprint vs. CNCF Prometheus/Grafana/Loki        |

---

## Contributing

We welcome community contributions, bug reports, and feature proposals! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for local development setup, coding standards, and PR workflows.

All participants must abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the **[MIT License](LICENSE)**. Free for personal, academic, and commercial use.
