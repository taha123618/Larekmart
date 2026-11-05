---
name: ticket-lifecycle
description: Use when authoring, modifying, testing, or debugging support ticket creation, categories, message timelines, customer replies, internal staff notes, or ticket events in support-service.
---

# Support Ticket Lifecycle Playbook — support-service

This playbook covers the authoritative standards and execution patterns for `apps/support-service` (:8025).

## 1. Responsibilities & Boundaries

- **Authoritative Support Data**: Owns `tickets`, `ticket_messages`, `ticket_assignments`, `ticket_categories`, `ticket_sla_policies`, and `ticket_history` in PostgreSQL (`larekmart_support_db`) via `@repo/support-db`.
- **Zero-Trust Role Scoping**:
  - Customers can only list and read tickets where `customerId === actor.userId`.
  - Sellers can list and read tickets where `sellerId === actor.userId`.
  - Administrators (`role === "admin" / "super_admin"`) have full visibility across all customer and seller tickets.
- **Message Privacy & Redaction**:
  - Messages with `isInternalNote: true` are staff-only notes.
  - The service strictly filters and redacts internal notes when returning ticket entities to non-admin callers.
  - Non-admin callers attempting to post an internal note are rejected with HTTP 403 Forbidden.
- **Async Cross-Service Communication**:
  - Emits: `support.ticket.created`, `support.ticket.assigned`, `support.ticket.updated`, `support.ticket.resolved`.
  - Consumes: `return.rejected`, `dispute.created`, `fraud.case.escalated` for automated ticket generation and arbitration.

## 2. API Routes

| Method  | Path                                   | Auth          | Purpose                                                           |
| :------ | :------------------------------------- | :------------ | :---------------------------------------------------------------- |
| `POST`  | `/api/v1/support/tickets`              | User / Seller | Submit new ticket, assign SLA deadlines, emit `ticket.created`    |
| `GET`   | `/api/v1/support/tickets`              | User / Seller | List user's own tickets with status and priority filtering        |
| `GET`   | `/api/v1/support/tickets/:id`          | User / Seller | Get ticket with messages (internal notes redacted for non-admins) |
| `POST`  | `/api/v1/support/tickets/:id/messages` | User / Seller | Add customer reply; moves status to `WAITING_ON_AGENT`            |
| `PATCH` | `/api/v1/support/tickets/:id`          | User / Seller | Update ticket status (e.g. mark resolved)                         |
| `GET`   | `/api/v1/support/categories`           | Public / User | List active ticket intake categories                              |
| `GET`   | `/api/v1/admin/support/tickets`        | Admin         | Global ticket registry with full queue filters                    |
| `GET`   | `/api/v1/admin/support/tickets/:id`    | Admin         | Full ticket entity with staff notes and audit logs                |
| `POST`  | `/api/v1/admin/support/:id/messages`   | Admin         | Post public agent reply or private internal staff note            |
| `GET`   | `/health` / `/ready`                   | Public        | Probes for container orchestration                                |
| `GET`   | `/metrics`                             | Public        | Prometheus scrape endpoint                                        |

## 3. Testing & Verification

```bash
# Run unit & integration test suites
pnpm --filter support-service test

# TypeScript type check
pnpm --filter support-service check-types
```
