# Comprehensive Security Audit & Remediation Report (Phase II)

**Target Scope:** Monorepo Workspaces (`apps/support-service`, `apps/api-gateway`, `packages/support-db`, `@repo/types`, and connected microservices).  
**Standard:** OWASP Top 10 API Security Risks, Zero-Trust Perimeter Principles, Cryptographic Timing Defenses, Broken Access Control (BAC/IDOR/BFLA).  
**Auditor:** Antigravity AI Cybersecurity Specialist.

---

## 1. Executive Summary & Audit Overview

Following the instruction to perform a deep security audit and patch all vulnerabilities across the codebase, a systematic audit was conducted on the newly integrated **Support Service** (`apps/support-service`), its database package (`@repo/support-db`), the centralized **API Gateway** (`apps/api-gateway`), and perimeter ingress protections.

Seven new security vulnerabilities (**SEC-28 through SEC-34**) were identified across authentication handshakes, access control, object-level authorization, tenant isolation, and perimeter header sanitization. All seven vulnerabilities have been defensively patched and verified through automated test suites and monorepo-wide type checking (**44/44 packages clean**).

### Vulnerability Summary Matrix

| Finding ID |   Severity   | CWE               | Vulnerability Description                                                            |   Remediation Status    |
| :--------- | :----------: | :---------------- | :----------------------------------------------------------------------------------- | :---------------------: |
| **SEC-28** | **CRITICAL** | CWE-285 / CWE-200 | Unauthenticated Socket.IO Handshake & Global Real-time Ticket Broadcasts             | **RESOLVED & VERIFIED** |
| **SEC-29** |   **HIGH**   | CWE-639 / CWE-284 | Insecure Direct Object Reference (IDOR) & Customer Impersonation in Ticket Creation  | **RESOLVED & VERIFIED** |
| **SEC-30** |  **MEDIUM**  | CWE-285 / CWE-862 | Broken Function-Level Authorization (BFLA) on Status Transitions & Metadata Mutation | **RESOLVED & VERIFIED** |
| **SEC-31** |   **HIGH**   | CWE-384 / CWE-200 | Cross-User Idempotency Key Collision & Cached Replay Information Disclosure          | **RESOLVED & VERIFIED** |
| **SEC-32** |  **MEDIUM**  | CWE-284 / CWE-200 | Incomplete Perimeter Header Stripping (`x-user-email`) in API Gateway                | **RESOLVED & VERIFIED** |
| **SEC-33** |   **LOW**    | CWE-693 / CWE-942 | Missing Defensive HTTP Security Headers & Origin Resolvers in Support Service        | **RESOLVED & VERIFIED** |
| **SEC-34** |   **LOW**    | CWE-1188          | Dual Environment Variable Alignment for Support Service Boot Validation              | **RESOLVED & VERIFIED** |

---

## 2. In-Depth Vulnerability Analysis & Defenses

### SEC-28 [CRITICAL]: Unauthenticated Socket.IO Handshake & Real-Time Data Leakage

- **Affected File:** [`apps/support-service/src/realtime/realtime.service.ts`](../../apps/support-service/src/realtime/realtime.service.ts)
- **Vulnerability Class:** CWE-285 (Improper Authorization), CWE-200 (Exposure of Sensitive Information)
- **Vulnerability Mechanics & Attack Vectors:**
  1. The Socket.IO server previously accepted WebSocket connections without executing any handshake authentication middleware (`io.use(...)`).
  2. Any unauthenticated caller connecting to `/socket.io` could emit `join:ticket` with arbitrary ticket IDs and eavesdrop on private customer/seller conversations and internal agent updates.
  3. `notifyTicketCreated` broadcasted newly created tickets globally with `this.io.emit("ticket:created", ticket)`. This exposed customer emails, issue descriptions, order IDs, payment IDs, and return IDs to all connected external sockets.
  4. Callers could join `join:agent` and `join:team` without verifying agent identity or staff privileges.
- **Defensive Remediation:**
  1. Implemented a zero-trust handshake authentication middleware (`this.io.use(...)`):
     - Validates `x-internal-secret` using constant-time comparison (`safeTimingCompare`).
     - Extracts and binds authenticated actor credentials (`userId`, `role`, `isSeller`, `isAdmin`, `isInternal`) to `socket.data`.
     - In production, connections lacking internal secret validation or authenticated identity fail closed immediately.
  2. Guarded room subscriptions:
     - `join:ticket`: Queries PostgreSQL to verify that the connecting actor is an administrator or the explicit owner (`ticket.customerId === socket.data.userId` or `ticket.sellerId === socket.data.userId`). Unauthorized attempts emit an access-denied error and block room entry.
     - `join:agent`: Restricted to administrators or the authenticated agent themselves (`socket.data.userId === agentId`).
     - `join:team`: Strictly restricted to administrators.
  3. Replaced global broadcasts:
     - Replaced `this.io.emit("ticket:created", ticket)` with targeted dispatches to `team:staff`, `user:${ticket.customerId}`, and `seller:${ticket.sellerId}`. Global broadcasts of customer tickets are permanently eliminated.

---

### SEC-29 [HIGH]: IDOR & Customer Impersonation in Ticket Creation

- **Affected File:** [`apps/support-service/src/modules/tickets/tickets.service.ts`](../../apps/support-service/src/modules/tickets/tickets.service.ts)
- **Vulnerability Class:** CWE-639 (Insecure Direct Object Reference), CWE-284 (Improper Access Control)
- **Vulnerability Mechanics & Attack Vectors:**
  In `createTicket()`:
  ```typescript
  const customerId = input.customerId || (actor.isSeller ? null : actor.userId);
  const customerEmail = input.customerEmail || actor.email;
  const sellerId = input.sellerId || (actor.isSeller ? actor.userId : null);
  ```
  An authenticated malicious customer could pass `customerId: "victim-uuid"` or `customerEmail: "victim@example.com"` in the request body. Because `input.customerId` took precedence, tickets were created under the victim's account, allowing identity spoofing, false dispute generation, and harassment.
- **Defensive Remediation:**
  Decoupled administrative flexibility from standard user flows. Non-administrators (`!isActorAdmin`) are strictly forced to use their verified identity:
  ```typescript
  const customerId = isActorAdmin
    ? input.customerId || (actor.isSeller ? null : actor.userId)
    : actor.isSeller
      ? null
      : actor.userId;
  const customerEmail = isActorAdmin
    ? input.customerEmail || actor.email
    : actor.email || input.customerEmail;
  const sellerId = isActorAdmin
    ? input.sellerId || (actor.isSeller ? actor.userId : null)
    : actor.isSeller
      ? actor.userId
      : input.sellerId || null;
  ```

---

### SEC-30 [MEDIUM]: Broken Function-Level Authorization on Status Transitions & Metadata

- **Affected File:** [`apps/support-service/src/modules/tickets/tickets.service.ts`](../../apps/support-service/src/modules/tickets/tickets.service.ts)
- **Vulnerability Class:** CWE-285 (Improper Authorization), CWE-862 (Missing Authorization)
- **Vulnerability Mechanics & Attack Vectors:**
  `PATCH /api/v1/support/tickets/:id` permitted customers to modify any status transition (such as reverting a ticket to `IN_PROGRESS` or moving it to `WAITING_ON_CUSTOMER`) or overwrite internal `metadata` JSON blobs.
- **Defensive Remediation:**
  Enforced a strict function-level authorization rule for non-admins:
  ```typescript
  if (!isAdmin) {
    if (input.priority || input.categoryCode) {
      throw new ForbiddenException(
        "Only admins can modify ticket priority or category",
      );
    }
    if (input.metadata) {
      throw new ForbiddenException(
        "Only administrators can modify ticket metadata",
      );
    }
    if (
      input.status &&
      input.status !== "RESOLVED" &&
      input.status !== "CLOSED"
    ) {
      throw new ForbiddenException(
        "Non-administrators can only transition tickets to RESOLVED or CLOSED",
      );
    }
  }
  ```

---

### SEC-31 [HIGH]: Cross-User Idempotency Key Collision & Cached Replay Leaks

- **Affected File:** [`apps/support-service/src/common/interceptors/idempotency.interceptor.ts`](../../apps/support-service/src/common/interceptors/idempotency.interceptor.ts)
- **Vulnerability Class:** CWE-384 (Session Fixation / Insecure Key Scope), CWE-200 (Information Exposure)
- **Vulnerability Mechanics & Attack Vectors:**
  Idempotency locks and cached responses were keyed using only the raw header value:
  `support:idemp:${rawKey.trim()}`.
  If User A submitted a mutation with `Idempotency-Key: "order-123"`, and User B submitted a request with the identical key:
  1. If in-flight, User B received a `409 Conflict` (Denial of Service).
  2. If completed, User B received `Idempotent-Replayed: true` along with User A's private ticket response containing User A's email, subject, description, and internal IDs.
- **Defensive Remediation:**
  Namespaced the Redis idempotency lease with the authenticated `userId`:
  ```typescript
  const userId = request.user?.userId || "anon";
  const redisKey = keys.simple(`support:idemp:${userId}:${rawKey.trim()}`);
  ```
  Added a dedicated unit test in `tests/unit/idempotency.unit.test.ts` verifying that identical idempotency keys from different user identities execute independently without collision or cache leakage.

---

### SEC-32 [MEDIUM]: Incomplete Perimeter Header Stripping in API Gateway

- **Affected Files:**
  - [`apps/api-gateway/src/middleware/request-id.ts`](../../apps/api-gateway/src/middleware/request-id.ts)
  - [`apps/api-gateway/src/gateway/proxy.ts`](../../apps/api-gateway/src/gateway/proxy.ts)
- **Vulnerability Class:** CWE-284 (Improper Access Control), CWE-200 (Information Exposure)
- **Vulnerability Mechanics & Attack Vectors:**
  While `x-user-id` and `x-user-role` were stripped at the API Gateway perimeter, `x-user-email` and `x-customer-email` were omitted from `FORBIDDEN_CLIENT_HEADERS`. External attackers could send arbitrary `x-user-email` headers, which were forwarded to downstream services that relied on this header for audit logging or notifications.
- **Defensive Remediation:**
  Added `x-user-email` and `x-customer-email` to `FORBIDDEN_CLIENT_HEADERS` in `request-id.ts` and explicitly stripped them in `rewriteRequestHeaders` in `proxy.ts`.

---

### SEC-33 [LOW]: Missing Defensive HTTP Security Headers & Origin Resolvers

- **Affected File:** [`apps/support-service/src/main.ts`](../../apps/support-service/src/main.ts)
- **Vulnerability Class:** CWE-693 (Protection Mechanism Failure), CWE-942 (Permissive Cross-Domain Policy)
- **Defensive Remediation:**
  1. Replaced static origin splitting with `@repo/types` `resolveCorsOrigins`.
  2. Added a Fastify `onSend` hook injecting defensive security headers on all HTTP responses:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 1; mode=block`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

### SEC-34 [LOW]: Dual Environment Variable Validation Alignment

- **Affected File:** [`apps/support-service/src/config/env.ts`](../../apps/support-service/src/config/env.ts)
- **Vulnerability Class:** CWE-1188 (Insecure Default Initialization of Resource)
- **Defensive Remediation:**
  Updated `env.ts` to recognize both `INTERNAL_SERVICE_SECRET` and `GATEWAY_INTERNAL_SECRET` interchangeably, validating them fail-closed in production (`NODE_ENV === "production"`) via `validateInternalServiceSecret`.

---

## 3. Verification & Test Evidence

### Automated Test Execution Results

```
==================================================
  SUPPORT SERVICE TEST SUITE (70 passed, 0 failed)
==================================================
  • SLA Engine Unit Tests: 12/12 passed
  • Auth & Admin Guards Unit Tests: 17/17 passed
  • Schemas & Validation Unit Tests: 17/17 passed
  • Distributed Idempotency Unit Tests: 6/6 passed (includes cross-user isolation)
  • Tickets Integration Tests: 12/12 passed
  • SLA & Escalation Integration Tests: 6/6 passed

==================================================
  API GATEWAY TEST SUITE
==================================================
  • Route Registry tests passed
  • Dynamic Circuit Breaker tests passed
  • InFlightBulkhead & Adaptive Rate Limiting tests passed
  • Header stripping verification tests passed

==================================================
  TURBO MONOREPO TYPE CHECK
==================================================
  • 44 successful, 44 total (0 errors across all packages and services)
```
