# Cart Service Distributed Locking & Idempotency Hardening

## Overview
High-concurrency e-commerce operations (flash sales, rapid double-clicks, cross-tab session merges) expose cart mutations to severe race conditions:
1. **Concurrent Guest-to-User Cart Merge Conflicts**: When multiple merge requests arrive simultaneously (e.g. login triggered across multiple tabs or network retry), both read active guest and user carts concurrently, producing duplicate item lines and Mongoose `VersionError` write conflicts.
2. **Missing Mutation Idempotency**: State-mutating routes (`POST /cart/merge`, `POST /cart/items`, `POST /cart/coupons`) lack distributed idempotency lease enforcement (`Idempotency-Key` header), risking redundant cart updates or duplicate items on client retries.
3. **Cart Mutation Concurrency Isolation**: Concurrent item adjustments on the same cart without a distributed lock can cause lost updates when one request overwrites changes from another request.

## Target Architecture

### 1. Redis Distributed Lock on Cart Operations (`withClusterLock`)
- Acquire a distributed lock via `@repo/redis`'s `withClusterLock`:
  - For merge operations: `cart:lock:merge:{userId}` (TTL: 5,000ms).
  - If a merge is already in-flight for that user, reject subsequent requests immediately with HTTP 409 Conflict (`{ message: "A cart merge operation is currently in-flight for this user" }`).
- Within the lock, re-check `guestCart.status === "active"`. If already marked `"merged"`, return the existing active `userCart` safely without duplicating items (idempotent merge behavior).

### 2. Distributed Idempotency Middleware (`idempotency.middleware.ts`)
- Implements `Idempotency-Key` header processing:
  - If `Idempotency-Key` is present:
    - Atomically calls `acquireIdempotencyLock(redis.client, `cart:idempotency:${key}`, { lockTtlMs: 10000 })`.
    - If status is `"replayed"`, intercepts the response and immediately replays the cached status code and payload with header `X-Cache-Lookup: HIT`.
    - If status is `"conflict"`, returns HTTP 409 Conflict with `{ message: "A mutation with this Idempotency-Key is currently in-flight" }`.
    - If status is `"acquired"`, intercepts `res.json` / `res.send` to automatically call `commitIdempotencyResponse(redis.client, ...)` on successful 2xx status codes, or `releaseIdempotencyLock` on 4xx/5xx errors.
  - If `Idempotency-Key` is omitted, requests proceed normally.

### 3. Verification & Safety
- Full unit and concurrency tests verifying:
  - Idempotency key replay and in-flight conflict rejection.
  - Concurrent merge contention locking and duplicate item prevention.
- Monorepo typecheck validation across all 41 packages.

