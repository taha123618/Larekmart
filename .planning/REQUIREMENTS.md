# Requirements: Larekmart E-Commerce Platform

**Defined:** 2026-10-02
**Core Value:** Reliable, zero-downtime apparel discovery and checkout powered by strictly asynchronous event-driven microservices with zero service-to-service HTTP coupling.

## v1 Requirements

### Storefront Application (`apps/client`)

- [ ] **CLI-01**: User can browse catalog with category filter, sorting, and full-text search
- [ ] **CLI-02**: User can view product details with multi-angle image gallery and select color/size variants
- [ ] **CLI-03**: User can maintain persistent shopping cart with variant options and quantity controls
- [ ] **CLI-04**: User can complete checkout via embedded Stripe Elements payment session
- [ ] **CLI-05**: User can view order confirmation receipt and post-payment fulfillment status

### Admin Management Portal (`apps/admin`)

- [ ] **ADM-01**: Admin can authenticate via Clerk RBAC (`sessionClaims.metadata.role === "admin"`)
- [ ] **ADM-02**: Admin can review live executive KPI metrics (revenue, orders, active customers)
- [ ] **ADM-03**: Admin can create, edit, price, and categorize apparel products and manage stock status
- [ ] **ADM-04**: Admin can monitor and update order lifecycle status (`pending`, `paid`, `processing`, `shipped`)

### Core Services & Messaging

- [ ] **SRV-01**: `payment-service` validates Stripe webhook signatures and emits `payment.succeeded` event to Kafka
- [ ] **SRV-02**: `order-service` consumes `payment.succeeded` and persists order document into MongoDB
- [ ] **SRV-03**: `inventory-service` consumes order events and deducts available stock ledger in PostgreSQL
- [ ] **SRV-04**: `email-service` consumes order events and dispatches transactional confirmation emails
- [ ] **SRV-05**: `notification-service` streams real-time order updates to storefront clients over WebSockets

## v2 Requirements

### Advanced Features & Recommendations

- **REC-01**: Hybrid AI recommendation carousels based on vector similarity (`pgvector`)
- **SHIP-01**: Live carrier rate lookups and tracking webhook ingestion (TCS, Leopards, DHL, FedEx)
- **SRCH-01**: Personalized autocomplete and semantic search queries via OpenSearch

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct Service-to-Service HTTP | Prohibited by ADR-0001; all service communication is via Kafka |
| Custom Auth Credentials Database | Prohibited by ADR-0003; delegated entirely to Clerk |
| Monolithic Shared Database | Prohibited by ADR-0002; database-per-service pattern enforced |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Pending |
| CLI-02 | Phase 1 | Pending |
| CLI-03 | Phase 1 | Pending |
| CLI-04 | Phase 2 | Pending |
| CLI-05 | Phase 2 | Pending |
| ADM-01 | Phase 3 | Pending |
| ADM-02 | Phase 3 | Pending |
| ADM-03 | Phase 3 | Pending |
| ADM-04 | Phase 3 | Pending |
| SRV-01 | Phase 2 | Pending |
| SRV-02 | Phase 2 | Pending |
| SRV-03 | Phase 2 | Pending |
| SRV-04 | Phase 2 | Pending |
| SRV-05 | Phase 3 | Pending |
