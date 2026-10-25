# Architecture Decision Records (ADRs)

This directory documents the significant architectural decisions made in Larekmart.

## Index of Records

| ADR                                                                | Title                                                                    | Status   | Date       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------- | ---------- |
| [0001](./0001-asynchronous-kafka-integration.md)                   | Asynchronous Kafka Integration for Backend Services                      | Accepted | 2025-01-15 |
| [0002](./0002-polyglot-persistence.md)                             | Polyglot Persistence (PostgreSQL for Catalog, MongoDB for Orders)        | Accepted | 2025-01-20 |
| [0003](./0003-clerk-authentication.md)                             | Centralized Authentication and Role Management via Clerk                 | Accepted | 2025-01-25 |
| [0004](./0004-product-reviews-and-reputation-engine.md)            | Product Reviews, Reputation Engine & Verified Purchase Architecture      | Accepted | 2026-10-14 |
| [0005](./0005-seller-vendor-management-and-delegated-authority.md) | Seller and Vendor Management, Platform Controls, and Delegated Authority | Accepted | 2026-10-25 |

## Adding an ADR

When recording a new architectural decision, create a file named `NNNN-short-title.md` following this template:

- **Title**: Context and decision name
- **Status**: `Proposed | Accepted | Superseded | Deprecated`
- **Context**: The problem being solved and constraints
- **Decision**: The chosen technical approach
- **Consequences**: Trade-offs, benefits, and architectural implications
