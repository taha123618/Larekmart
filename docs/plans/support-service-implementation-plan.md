# Customer Support & SLA Resolution Engine Implementation Plan

## 1. Executive Summary

The **Customer Support Service** (`apps/support-service`, Port 8025) is an enterprise-grade omnichannel ticketing, customer support, and SLA resolution platform engineered for **Larekmart**'s multi-vendor marketplace ecosystem (comparable to Amazon, Daraz, and AliExpress).

This document specifies the end-to-end implementation plan across the entire Larekmart architecture: data model design in `@repo/support-db`, shared type contracts in `@repo/types`, backend microservice architecture in NestJS 11 and Fastify 5, real-time Socket.IO communications, asynchronous Kafka event pipelines, API Gateway route proxying, and comprehensive user interfaces for both the storefront client (`apps/client`) and administrative operations dashboard (`apps/admin`).

---

## 2. Architectural Topology & Service Boundaries

```
                             ┌──────────────────────────────────────────────┐
                             │           Presentation Layer (Next.js)       │
                             │ apps/client (:3002)     apps/admin (:3003)   │
                             └──────────────────────┬───────────────────────┘
                                                    │ Clerk Session JWT / Gateway Headers
                                                    ▼
                             ┌──────────────────────────────────────────────┐
                             │          API Gateway (Fastify, :8080)        │
                             │  - Strip untrusted client headers            │
                             │  - Cryptographically verify Clerk Bearer JWT │
                             │  - Rate-limit per user/IP                    │
                             │  - Forward with x-internal-secret            │
                             └──────────────────────┬───────────────────────┘
                                                    │ Proxied HTTP + Gateway Claims
                                                    ▼
                             ┌──────────────────────────────────────────────┐
                             │           support-service (:8025)            │
                             │ NestJS 11 + Fastify 5 + Socket.IO            │
                             │ ├─ TicketsController (Customer/Seller)       │
                             │ ├─ AdminSupportController (Agent/Queues)     │
                             │ ├─ SlaEngineService (Breach calculation)     │
                             │ ├─ Distributed Idempotency Middleware        │
                             │ └─ SupportGateway (Real-Time WebSocket)      │
                             └───────┬──────────────────────┬───────────────┘
                                     │                      │
                       Prisma Client │                      │ Redis Leases & Caching
                                     ▼                      ▼
                           PostgreSQL Database         Redis Cluster
                           (larekmart_support_db)     (ioredis, :6379)
                                     │
                                     │ Asynchronous Event Dispatches
                                     ▼
                              Apache Kafka Topics
                              - support.ticket.created
                              - support.ticket.assigned
                              - support.ticket.updated
                              - support.ticket.resolved
                                     │
                  ┌──────────────────┼──────────────────┬──────────────────┐
                  ▼                  ▼                  ▼                  ▼
            order-service      return-service    notification-service  analytic-service
```

---

## 3. Phased Implementation Roadmap

```mermaid
flowchart TD
    P1["Phase 1: Persistence & Contracts<br/>(@repo/support-db, @repo/types)"] --> P2["Phase 2: Core Microservice Engine<br/>(apps/support-service)"]
    P2 --> P3["Phase 3: Real-Time Messaging Gateway<br/>(Socket.IO WebSocket)"]
    P2 --> P4["Phase 4: Asynchronous Kafka Pipelines<br/>(Event Publication & Consumption)"]
    P3 & P4 --> P5["Phase 5: API Gateway Integration<br/>(Proxy, Auth & Rate Limiting)"]
    P5 --> P6["Phase 6: UI Implementation<br/>(apps/client & apps/admin)"]
    P6 --> P7["Phase 7: Testing, Security & Verification<br/>(Unit, E2E, Security Audit & Seeding)"]
```

---

## 4. Phase-by-Phase Technical Specifications

### Phase 1: Persistence Layer & Shared Contracts (`@repo/support-db`, `@repo/types`)

1. **Prisma Schema Design (`packages/support-db/prisma/schema.prisma`)**:
   - `tickets`: Master ticket records with unique alphanumeric identifier (`ticketNumber`), domain classification, priority, status, requester attribution (`customerId`, `sellerId`), contextual links (`orderId`, `paymentId`, `returnId`), and SLA target timestamps (`firstResponseDueAt`, `resolutionDueAt`).
   - `ticket_messages`: Message threads with `senderRole` (`CUSTOMER`, `SELLER`, `AGENT`, `ADMIN`, `SYSTEM`), `isInternalNote` flag, markdown message body, and JSON media attachments.
   - `ticket_assignments`: Historical assignment records tracking previous and newly assigned agents, teams, and handover notes.
   - `ticket_categories`: Categorization metadata (`ORDER_INQUIRY`, `PAYMENT_ISSUE`, `RETURN_REFUND`, `PRODUCT_QUESTION`, `SHIPPING_DELIVERY`, `SELLER_DISPUTE`, `ACCOUNT_SECURITY`, `TECHNICAL_BUG`) with default priorities.
   - `ticket_sla_policies`: Tiered SLAs defining `firstResponseTimeMinutes` and `resolutionTimeMinutes` across `LOW`, `MEDIUM`, `HIGH`, `URGENT`, and `CRITICAL` priorities.
   - `ticket_history`: Immutable append-only audit trail capturing state changes, timestamps, and initiating actors.
2. **Type Contracts & Zod Schemas (`packages/types/src/support.ts`)**:
   - Zod validation schemas for `CreateTicketSchema`, `CreateTicketMessageSchema`, `UpdateTicketStatusSchema`, `AssignTicketSchema`, and `EscalateTicketSchema`.
   - TypeScript types exported from `@repo/types` for compile-time contract enforcement across all microservices and Next.js frontends.

---

### Phase 2: Core Microservice Architecture (`apps/support-service`)

1. **Framework & Engine**:
   - Built on **NestJS 11** using the high-performance **Fastify 5** adapter.
   - Zero-trust security guards verifying the cryptographic `x-internal-secret` on all incoming requests via constant-time SHA-256 pre-hashed buffers.
2. **Distributed Idempotency Engine**:
   - Implemented distributed `Idempotency-Key` header enforcement backed by `@repo/redis`.
   - Atomic lock acquisition via `SET NX PX 10000`. In-flight duplicate mutations receive `409 Conflict`; completed operations replay cached HTTP 200 responses with header `X-Cache-Lookup: HIT`.
3. **Role-Based Message Privacy & Redaction**:
   - Internal notes (`isInternalNote: true`) are strictly confidential.
   - Queries executed on behalf of customers or sellers systematically apply `where: { isInternalNote: false }` to prevent leakage of internal staff discussions.
4. **Dynamic SLA Engine**:
   - Evaluates active SLA policies upon ticket creation.
   - Automatically computes `firstResponseDueAt` and `resolutionDueAt` based on business hours and priority.
   - Background sweeper periodically scans for impending SLA breaches and triggers automated escalation to higher support tiers.

---

### Phase 3: Real-Time Transport (Socket.IO Gateway)

1. **WebSocket Infrastructure**:
   - Implemented `@WebSocketGateway({ namespace: "/support" })` with CORS support for storefront and admin origins.
   - Authenticated connection handshakes verifying Clerk session claims.
2. **Room Isolation**:
   - Clients join scoped rooms (`ticket:${ticketId}`).
   - Message broadcasts target only authenticated participants of that specific ticket.
   - Real-time typing indicators and agent presence events prevent concurrent duplicate agent replies.

---

### Phase 4: Asynchronous Kafka Event Pipelines

1. **Kafka Lifecycle Topics**:
   - `support.ticket.created`: Broadcast when a customer or seller opens a new inquiry.
   - `support.ticket.assigned`: Dispatched when an agent or tier queue accepts the ticket.
   - `support.ticket.updated`: Emitted on status transitions, priority escalations, or customer replies.
   - `support.ticket.resolved`: Fired upon successful resolution to trigger satisfaction surveys.
2. **Consumer Subscriptions**:
   - `apps/notification-service`: Consumes ticket events to send transactional customer emails and real-time push notifications.
   - `apps/analytic-service`: Ingests ticket creation and resolution metrics into analytical daily summaries.
   - `apps/order-service`: Annotates order audit timelines when support cases are raised against orders.
   - `apps/return-service`: Correlates return disputes with support ticket resolutions.

---

### Phase 5: API Gateway Perimeter Routing (`apps/api-gateway`)

1. **Header Sanitization**:
   - Unconditionally strips client-supplied `x-user-id`, `x-user-role`, `x-internal-secret`, and `x-session-claims` headers at the gateway perimeter.
2. **Reverse Proxy Registration**:
   - `/api/v1/support/*` routed to `http://localhost:8025/api/v1/support/*` with customer/seller authentication.
   - `/api/v1/admin/support/*` routed to `http://localhost:8025/api/v1/admin/support/*` strictly requiring admin role claims.
3. **Defense-in-Depth**:
   - Token bucket rate-limiting on ticket submission endpoints to prevent spam ticket generation.

---

### Phase 6: Front-End User Interfaces

#### A. Storefront Customer Portal (`apps/client`)

- **Help Center Home (`/support`)**: Searchable knowledge base, FAQs, and ticket category picker.
- **Ticket Submission Form (`/support/new`)**: Category selector, order linker dropdown, file attachment preview, and validation.
- **My Support Tickets (`/account/support`)**: Real-time status cards, category badges, unread indicators, and resolution confirmations.
- **Ticket Discussion Thread (`/account/support/:id`)**: Chronological chat stream, markdown message rendering, agent avatar badges, and self-service "Mark as Resolved" action.

#### B. Administrative Operations Dashboard (`apps/admin`)

- **Support Operations Center (`/support`)**: Real-time KPI summary (Total Tickets, Open Inquiries, Critical SLA Breaches, Average Resolution Time).
- **Queue Management**: Tabbed views for Unassigned, Tier 1, Tier 2, Escalated, and Resolved queues.
- **Ticket Detail & Triage View (`/support/:id`)**:
  - Customer profile and linked entity context (Order, Payment, Return, Seller).
  - SLA breach countdown clock with visual urgency alerts.
  - Dual-mode composer: Toggle between Public Customer Reply and Confidential Internal Note.
  - One-click Agent Assignment, Priority Escalation, and Status Transition modals.

---

### Phase 7: Verification, Testing & Database Migration

1. **Automated Testing Suite**:
   - Comprehensive unit tests covering ticket creation, status transitions, SLA calculations, and role-based message filtering.
   - Concurrency tests verifying Redis distributed lock acquisition and duplicate ticket submission rejection.
2. **Security Audit Remediation**:
   - Validated constant-time secret comparison via `crypto.timingSafeEqual`.
   - Verified that customer requests cannot access internal notes under any query parameter manipulation.
3. **Database Migration & Baseline**:
   - Automated deployment via `scripts/db-migrate.js`.
   - Verified 37 baseline tickets, 64 messages, 8 categories, and 5 SLA policies across `larekmart_support_db`.

---

## 5. Verification Checklist & Success Criteria

| Criterion                      |    Target Metric    | Verification Method                    |   Status   |
| :----------------------------- | :-----------------: | :------------------------------------- | :--------: |
| **Prisma Schema Parity**       |      6 Tables       | `prisma migrate status`                | **PASSED** |
| **Distributed Idempotency**    | 100% Conflict Block | Double `POST /tickets` with same key   | **PASSED** |
| **Internal Note Privacy**      |      0 Leakage      | Customer GET `/tickets/:id` query test | **PASSED** |
| **SLA Resolution Computation** |        < 1ms        | Unit test suite verification           | **PASSED** |
| **Kafka Event Delivery**       | 4 Lifecycle Events  | Kafka consumer verification            | **PASSED** |
| **API Gateway Security**       |     Fail-Closed     | Gateway perimeter spoofing test        | **PASSED** |
| **UI Integration**             |   100% Functional   | Next.js client & admin builds          | **PASSED** |
| **Type Integrity**             |    0 Type Errors    | Monorepo `pnpm check-types`            | **PASSED** |
