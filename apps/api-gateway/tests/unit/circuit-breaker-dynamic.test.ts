/**
 * Dynamic Circuit Breaker — Sliding Window & Self-Tuning Tests
 *
 * Tests the hybrid sliding-window circuit breaker covering:
 *  1. Minimum-window-call gate (no early trips)
 *  2. Failure-rate trip (≥ 50%)
 *  3. Slow-call-rate trip (≥ 50%)
 *  4. HALF_OPEN canary: 3 consecutive successes → CLOSED
 *  5. HALF_OPEN probe failure → OPEN with doubled backoff
 *  6. Upstream Retry-After header feedback (CLOSED/HALF_OPEN → forced OPEN)
 *  7. Upstream Retry-After extends existing OPEN wait time
 *  8. Mixed failure+success keeps CLOSED while rate < threshold
 *  9. Reset clears state and metrics
 */

import assert from "node:assert/strict";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";

export async function runCircuitBreakerDynamicTests() {
  console.log("▶ [UNIT] Running Dynamic Circuit Breaker tests...");

  // ── 1. Min-window gate prevents early trips ───────────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 5,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 200,
      successThreshold: 3,
    });
    const svc = "svc-min-window";

    // 4 failures — below minWindowCalls=5 → stays CLOSED
    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(
      cb.getState(svc),
      "CLOSED",
      "Should stay CLOSED below min-window",
    );
    assert.ok(cb.isAvailable(svc));
  }

  // ── 2. Failure-rate threshold trips to OPEN ───────────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 4,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 200,
      successThreshold: 3,
    });
    const svc = "svc-failure-rate";

    // 2 successes + 2 failures = 50% failure rate → should trip
    cb.recordSuccess(svc, 50);
    cb.recordSuccess(svc, 50);
    cb.recordFailure(svc, 50);
    assert.equal(cb.getState(svc), "CLOSED", "Not yet at minWindowCalls");
    cb.recordFailure(svc, 50);
    assert.equal(
      cb.getState(svc),
      "OPEN",
      "Should trip OPEN at 50% failure rate",
    );
    assert.equal(cb.isAvailable(svc), false);
  }

  // ── 3. Slow-call-rate threshold trips to OPEN ─────────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 4,
      slowCallThresholdMs: 1000,
      slowCallRateThreshold: 0.5,
      failureRateThreshold: 1.0, // won't trip on failure rate
      halfOpenInitialMs: 200,
      successThreshold: 3,
    });
    const svc = "svc-slow-call";

    // All successes but 3 of 4 are slow (above 1 000ms threshold)
    cb.recordSuccess(svc, 1500); // slow
    cb.recordSuccess(svc, 1500); // slow
    cb.recordSuccess(svc, 50); // fast
    assert.equal(cb.getState(svc), "CLOSED", "Not yet at minWindowCalls");
    cb.recordSuccess(svc, 1500); // slow — 4th call, 75% slow rate
    assert.equal(
      cb.getState(svc),
      "OPEN",
      "Should trip OPEN at 75% slow-call rate",
    );
  }

  // ── 4. HALF_OPEN canary: 3 consecutive successes → CLOSED ─────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 2,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 100,
      halfOpenMaxMs: 800,
      successThreshold: 3,
    });
    const svc = "svc-halfopen-close";

    // Trip to OPEN
    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(cb.getState(svc), "HALF_OPEN");

    // 3 consecutive successes → CLOSED
    cb.recordSuccess(svc, 20);
    assert.equal(
      cb.getState(svc),
      "HALF_OPEN",
      "Still HALF_OPEN after 1 success",
    );
    cb.recordSuccess(svc, 20);
    assert.equal(
      cb.getState(svc),
      "HALF_OPEN",
      "Still HALF_OPEN after 2 successes",
    );
    cb.recordSuccess(svc, 20);
    assert.equal(
      cb.getState(svc),
      "CLOSED",
      "Should be CLOSED after 3 consecutive successes",
    );
    assert.ok(cb.isAvailable(svc));
  }

  // ── 5. HALF_OPEN probe failure → OPEN with escalated backoff ──────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 2,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 100,
      halfOpenMaxMs: 800,
      successThreshold: 3,
    });
    const svc = "svc-halfopen-trip";

    // First trip
    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(cb.getState(svc), "HALF_OPEN");

    // Failure in probe → back to OPEN with doubled backoff (200ms)
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");
    assert.equal(cb.isAvailable(svc), false);

    // Verify backoff doubled: can't probe before ~200ms
    await new Promise((r) => setTimeout(r, 130));
    assert.equal(
      cb.getState(svc),
      "OPEN",
      "Should still be OPEN (in doubled backoff)",
    );
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(
      cb.getState(svc),
      "HALF_OPEN",
      "Should be HALF_OPEN after doubled backoff",
    );
  }

  // ── 6. feedUpstreamRetryAfter forces OPEN from CLOSED ─────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 5,
      halfOpenInitialMs: 5000,
      successThreshold: 3,
    });
    const svc = "svc-retry-after-closed";

    assert.equal(cb.getState(svc), "CLOSED");
    cb.feedUpstreamRetryAfter(svc, 0.2); // 200ms Retry-After
    assert.equal(
      cb.getState(svc),
      "OPEN",
      "Should trip OPEN via Retry-After from CLOSED",
    );

    // Should not be available during retry-after window
    assert.equal(cb.isAvailable(svc), false);

    // After 200ms it should probe
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(cb.getState(svc), "HALF_OPEN");
  }

  // ── 7. feedUpstreamRetryAfter extends existing OPEN wait ──────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 2,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 100,
      successThreshold: 3,
    });
    const svc = "svc-retry-after-extend";

    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");

    // Extend the wait by 500ms from now (longer than original 100ms)
    cb.feedUpstreamRetryAfter(svc, 0.5);

    // After 150ms it should still be OPEN (original would have expired)
    await new Promise((r) => setTimeout(r, 160));
    assert.equal(
      cb.getState(svc),
      "OPEN",
      "Extended Retry-After should keep circuit OPEN",
    );

    // After total ~550ms it should probe
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(cb.getState(svc), "HALF_OPEN");
  }

  // ── 8. Mixed calls below threshold stays CLOSED ───────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 10,
      failureRateThreshold: 0.5,
      slowCallRateThreshold: 0.5,
      halfOpenInitialMs: 200,
      successThreshold: 3,
    });
    const svc = "svc-below-threshold";

    // 6 successes + 4 failures = 40% failure rate — stays CLOSED
    for (let i = 0; i < 6; i++) cb.recordSuccess(svc, 100);
    for (let i = 0; i < 4; i++) cb.recordFailure(svc, 100);
    assert.equal(
      cb.getState(svc),
      "CLOSED",
      "40% failure rate should not trip circuit",
    );

    const snap = cb.windowSnapshot(svc);
    assert.equal(snap.total, 10);
    assert.equal(snap.failed, 4);
    assert.ok(Math.abs(snap.failureRate - 0.4) < 0.001);
  }

  // ── 9. reset() clears state and metrics ───────────────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 2,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 100,
      successThreshold: 3,
    });
    const svc = "svc-reset";

    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");

    cb.reset(svc);
    assert.equal(cb.getState(svc), "CLOSED", "After reset should be CLOSED");
    assert.ok(cb.isAvailable(svc));

    const snap = cb.windowSnapshot(svc);
    assert.equal(snap.total, 0, "Metrics should be cleared after reset");
  }

  // ── 10. Canary concurrency gating in HALF_OPEN ──────────────────────────
  {
    const cb = new CircuitBreaker({
      minWindowCalls: 2,
      failureRateThreshold: 0.5,
      halfOpenInitialMs: 100,
      canaryConcurrencyLimit: 2,
      successThreshold: 3,
    });
    const svc = "svc-canary-concurrency";

    cb.recordFailure(svc, 10);
    cb.recordFailure(svc, 10);
    assert.equal(cb.getState(svc), "OPEN");

    await new Promise((r) => setTimeout(r, 150));
    assert.equal(cb.getState(svc), "HALF_OPEN");

    // Probe 1 allowed
    assert.equal(cb.isAvailable(svc), true, "Probe 1 should be allowed");
    // Probe 2 allowed
    assert.equal(cb.isAvailable(svc), true, "Probe 2 should be allowed");
    // Probe 3 blocked by concurrency gate (limit = 2)
    assert.equal(
      cb.isAvailable(svc),
      false,
      "Probe 3 should be blocked by concurrency gate",
    );

    // Complete Probe 1 with success
    cb.recordSuccess(svc, 20);
    // Now a slot is freed, probe can proceed
    assert.equal(
      cb.isAvailable(svc),
      true,
      "Probe slot freed after probe 1 completed",
    );

    // Complete remaining probes to reach 3 successes
    cb.recordSuccess(svc, 20);
    cb.recordSuccess(svc, 20);
    assert.equal(
      cb.getState(svc),
      "CLOSED",
      "Should transition to CLOSED after 3 successes",
    );
    // Once closed, unlimited requests allowed
    assert.equal(cb.isAvailable(svc), true);
    assert.equal(cb.isAvailable(svc), true);
    assert.equal(cb.isAvailable(svc), true);
  }

  console.log("✔ [UNIT] Dynamic Circuit Breaker tests passed");
}
