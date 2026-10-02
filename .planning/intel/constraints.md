# Synthesized Architectural Constraints

- **No Cross-Service HTTP Calls:** Microservices must communicate solely via Kafka events (`@repo/kafka`). Direct service-to-service HTTP calls are strictly prohibited (ADR-0001).
- **Database Boundary Isolation:** Each service owns its dedicated database schema; no service may directly read or write another service's database (ADR-0002).
- **Clerk Authentication Mandatory:** User identities and admin RBAC are gated through Clerk JWT verification; custom credential or password stores are forbidden (ADR-0003).
- **Envelope Convention:** All Kafka events must follow the `{ value: payload }` envelope convention with shared types defined in `@repo/types`.
- **Non-Root Containers:** All runtime containers must execute as unprivileged non-root users (UID 1000/1001).
- **Strict Monorepo Dependency Boundaries:** Applications (`apps/*`) depend on shared packages (`packages/*`), packages never depend on apps, and apps never import from sibling apps.
