# Customer Support & SLA Resolution Engine Architecture (`apps/support-service`)

The **Customer Support Service** (`apps/support-service`, Port 8025) is an omnichannel ticketing and service-level agreement (SLA) resolution engine designed for **Larekmart**'s multi-vendor marketplace ecosystem (comparable to Amazon, Daraz, and AliExpress).

Built with **NestJS 11, Fastify 5, PostgreSQL (`@repo/support-db`), Prisma Client, Redis (`@repo/redis`), Apache Kafka (`@repo/kafka`), and Socket.IO**, it provides unified dispute handling, customer inquiries, seller communications, and agent queue orchestration.

---

## 1. System Topology & Cross-Service Integrations

```
                       ┌──────────────────────────────────────────────┐
                       │           Next.js Presentation Layer         │
                       │ apps/client (:3002)     apps/admin (:3003)   │
                       └──────────────────────┬───────────────────────┘
                                              │ Clerk Session JWT / Gateway Headers
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          API Gateway (Fastify, :8080)        │
                       │ Strip untrusted headers, verify Clerk claims,│
                       │ rate-limit, sign with x-internal-secret      │
                       └──────────────────────┬───────────────────────┘
                                              │ HTTP + Gateway Headers
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │           support-service (:8025)            │
                       │ NestJS 11 + Fastify + Socket.IO              │
                       │ ├─ TicketsController (Customer/Seller)       │
                       │ ├─ AdminSupportController (Staff/Queues)     │
                       │ ├─ SlaEngineService (Breach computation)     │
                       │ └─ SupportGateway (Real-time updates)        │
                       └───────┬──────────────────────┬───────────────┘
                               │                      │
                 Prisma Client │                      │ Redis Leases & Caching
                               ▼                      ▼
                     PostgreSQL Database         Redis Cluster
                     (larekmart_support_db)     (Idempotency & Queues)
                               │
                               │ Asynchronous Events
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

## 2. Core Responsibilities & Domain Invariants

1. **Omnichannel Ticket Management**:
   - Supports customer, seller, and administrator ticket creations with automated sequential ticket numbers (`TICK-YYYYMMDD-XXXXX`).
   - Categorization by operational domain: `ORDER_INQUIRY`, `PAYMENT_ISSUE`, `RETURN_REFUND`, `PRODUCT_QUESTION`, `SHIPPING_DELAY`, `SELLER_DISPUTE`, `ACCOUNT_SECURITY`, `TECHNICAL_SUPPORT`, `OTHER`.
2. **Confidentiality & Role-Based Message Visibility**:
   - Ticket messages support `isInternal: boolean`.
   - Internal staff notes, handover logs, and operational comments are strictly visible to admins/support agents.
   - External customer/seller threads strictly redact `isInternal: true` records to prevent internal discussion leaks.
3. **Automated SLA Policy Engine**:
   - Dynamic SLA evaluation matches category and priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
   - Automatically computes `firstResponseDueAt` and `resolutionDueAt` timestamps.
   - Monitors active tickets for impending breaches and overdue escalations.
4. **Contextual Entity Linking**:
   - Tickets link directly to platform entities: `orderId`, `productId`, `returnId`, `sellerId`.
   - Enables seamless navigation from order receipts or return requests into support threads.
5. **Real-Time Staff Queues & Operations Analytics**:
   - Workload distribution by agent assignment (`assignedToId`).
   - Resolution time metrics, open-versus-resolved ratios, and SLA compliance rates.

---

## 3. Data Architecture (`@repo/support-db`)

The persistence model is implemented in PostgreSQL via `@repo/support-db` using Prisma:

- **`tickets`**: Master ticket records with priority, status (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `WAITING_FOR_AGENT`, `RESOLVED`, `CLOSED`), SLA deadlines, and resolution metadata.
- **`ticket_messages`**: Public replies and internal staff notes with author attribution and optional media attachment URLs.
- **`ticket_assignments`**: Assignment audit history tracking previous and current assignees with assignment notes.
- **`ticket_categories`**: Master category configuration with default priorities and active flags.
- **`ticket_sla_policies`**: Configurable response and resolution time targets (in minutes) per category and priority.
- **`ticket_history`**: Append-only audit log tracking every field modification, status transition, and user actor.

---

## 4. API Specification

### 4.1 Storefront / Customer Endpoints (`/api/v1/support`)

- `POST /api/v1/support/tickets`: Create a new support ticket.
- `GET /api/v1/support/tickets`: List authenticated user's tickets (supports status, category, pagination).
- `GET /api/v1/support/tickets/:id`: Fetch ticket details and public messages (redacts internal notes).
- `POST /api/v1/support/tickets/:id/messages`: Post a public reply to the ticket thread.
- `PATCH /api/v1/support/tickets/:id`: Customer self-service status update (e.g. mark resolved).
- `GET /api/v1/support/categories`: Fetch active ticket categories for submission forms.

### 4.2 Administrator & Agent Operations (`/api/v1/admin/support`)

- `GET /api/v1/admin/support/tickets`: List all tickets with SLA breach indicators, agent filters, and sorting.
- `GET /api/v1/admin/support/tickets/:id`: Fetch complete ticket thread including confidential internal notes.
- `POST /api/v1/admin/support/tickets/:id/messages`: Post a public reply or internal note (`isInternal: true`).
- `POST /api/v1/admin/support/tickets/:id/assign`: Assign ticket to a support agent.
- `POST /api/v1/admin/support/tickets/:id/escalate`: Escalate ticket priority and assign to escalation tier.
- `GET /api/v1/admin/support/sla-policies`: List and configure SLA policy rules.
- `GET /api/v1/admin/support/analytics`: Aggregated ticket KPIs, SLA breach rates, and workload distribution.

---

## 5. Security & Zero-Trust Perimeter

1. **Perimeter Authentication**:
   - The API Gateway validates Clerk session tokens and sets verified `x-user-id`, `x-user-role`, `x-user-is-seller`, and `x-internal-secret` headers.
   - `support-service` validates `x-internal-secret` using constant-time cryptographic comparison (`safeTimingCompare`).
2. **Object-Level Authorization (IDOR Prevention)**:
   - Customers can only access tickets matching their verified `userId`.
   - Sellers can only access tickets referencing their `sellerId`.
   - Administrators have full queue access.
3. **Confidential Note Redaction**:
   - Non-admin queries run through an automatic filtering pipeline that strips all messages with `isInternal: true`.
4. **Idempotency Guarantees**:
   - State-mutating routes support `Idempotency-Key` headers backed by `@repo/redis` atomic leases.
