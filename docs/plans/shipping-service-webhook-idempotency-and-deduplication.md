# Shipping Service Webhook Idempotency & Logistics Deduplication Hardening

## Overview
Marketplace logistics carriers (TCS, Leopards, DHL, FedEx) send asynchronous webhook notifications for shipment lifecycle transitions (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`).

### Identified Bottlenecks & Race Conditions
1. **Non-Deterministic Event ID Fallback**:
   - In `WebhookService.processCarrierWebhook`, when an external carrier webhook omits an explicit `eventId`, the system fell back to:
     `const eventId = input.eventId ?? `${carrier}_${input.trackingNumber}_${Date.now()}`;`
   - Logistics carriers frequently retry webhook dispatches on transient network hiccups (504 gateway timeouts or packet drops). Because `Date.now()` changes with every millisecond, every retry received a brand new `eventId`, completely defeating deduplication and causing duplicate `TrackingEvent` records and duplicate `shipping.tracking_updated` Kafka events.
2. **Check-Then-Act Race Condition**:
   - The idempotency check checked `isWebhookProcessed` (Redis `EXISTS`) and DB `findFirst`, then processed the event, and only marked it processed at the end.
   - When carrier retry bursts deliver duplicate requests concurrently (<50ms apart), both requests observe `EXISTS === 0` and execute concurrently, creating duplicated tracking events and corrupting shipment state.

## Target Architecture

### 1. Deterministic Webhook Fingerprinting
- When `input.eventId` is absent or empty, construct a deterministic cryptographic SHA-256 fingerprint over immutable event attributes:
  `sha256(`${carrier}:${trackingNumber}:${status}:${timestamp || ""}`)`
- Ensures identical carrier retries produce the exact same deduplication key, regardless of elapsed time.

### 2. Redis Atomic In-Flight Lease (`SET NX PX`)
- Before processing, atomically claim an in-flight execution lease in Redis (`webhook:lease:${carrier}:${eventId}`) with a strict 15-second TTL.
- If another worker is actively processing the identical webhook event, fail-fast with `{ status: "ignored", message: "Concurrent webhook event currently in-flight" }`.
- Upon successful processing and database persistence, mark `webhook:processed:${carrier}:${eventId}` with a 24-hour retention TTL and release the temporary in-flight lease.

### 3. Verification & Safety
- Full unit and concurrency test suite in `tests/webhook-idempotency.test.ts`.
- Validation against carrier webhook simulation and Monorepo typecheck integrity across all 41 packages.

