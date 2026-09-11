# ADR 0003: Centralized Authentication and Role Management via Clerk

## Status

Accepted

## Context

Building and maintaining custom authentication, password resets, multi-factor authentication, and JWT signing across multiple microservices and frontends incurs high engineering overhead and security risk.

## Decision

Delegate all identity management, authentication, and session handling to Clerk across all applications and backend services:

- Frontends (`apps/client`, `apps/admin`) use `@clerk/nextjs` for session management and user interface components.
- Backend services validate Clerk JWT Bearer tokens using framework-specific SDKs (`@clerk/express`, `@clerk/fastify`, `@hono/clerk-auth`).
- Role-based access control (RBAC) relies on custom JWT claims (`sessionClaims.metadata.role === "admin"`).
- Admin user CRUD operations are centralized in `apps/auth-service` using the Clerk Backend SDK.

## Consequences

### Positive

- Unified security and identity layer across frontends and services.
- Eliminates custom credential storage and token generation logic.
- Simplified frontend-to-backend token forwarding.

### Negative

- Hard dependency on external Clerk API availability.
- Environment variables (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) required across all authenticated services.
