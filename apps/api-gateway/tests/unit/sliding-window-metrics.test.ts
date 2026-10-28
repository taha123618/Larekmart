/**
 * SlidingWindowMetrics unit tests
 *
 * Validates time-bucket rolling window mechanics independently of the
 * circuit breaker so failures are easier to pinpoint.
 */

import assert from "node:assert/strict";
import { SlidingWindowMetrics } from "../../src/resilience/sliding-window-metrics.js";

export async function runSlidingWindowMetricsTests() {
  console.log("▶ [UNIT] Running SlidingWindowMetrics tests...");

  // ── 1. Empty snapshot returns zeros ──────────────────────────────────────
  {
    const m = new SlidingWindowMetrics(10);
    const snap = m.snapshot("svc");
    assert.equal(snap.total, 0);
    assert.equal(snap.failed, 0);
    assert.equal(snap.failureRate, 0);
    assert.equal(snap.slowCallRate, 0);
  }

  // ── 2. Basic recording accumulates correctly ───────────────────────────
  {
    const m = new SlidingWindowMetrics(10);
    m.record("svc", false, 100, 500); // success, fast
    m.record("svc", true, 200, 500); // failure, fast
    m.record("svc", false, 600, 500); // success, slow (600 > 500)

    const snap = m.snapshot("svc");
    assert.equal(snap.total, 3);
    assert.equal(snap.failed, 1);
    assert.equal(snap.slow, 1);
    assert.ok(Math.abs(snap.failureRate - 1 / 3) < 0.001);
    assert.ok(Math.abs(snap.slowCallRate - 1 / 3) < 0.001);
  }

  // ── 3. slowCallThresholdMs boundary: exactly at threshold is slow ──────
  {
    const m = new SlidingWindowMetrics(10);
    m.record("svc", false, 500, 500); // exactly at threshold → slow
    m.record("svc", false, 499, 500); // just below → not slow

    const snap = m.snapshot("svc");
    assert.equal(snap.slow, 1);
    assert.ok(Math.abs(snap.slowCallRate - 0.5) < 0.001);
  }

  // ── 4. reset() clears the service ─────────────────────────────────────
  {
    const m = new SlidingWindowMetrics(10);
    m.record("svc-a", true, 100, 500);
    m.record("svc-b", true, 100, 500);

    m.reset("svc-a");
    assert.equal(m.snapshot("svc-a").total, 0, "svc-a should be cleared");
    assert.equal(m.snapshot("svc-b").total, 1, "svc-b should be unaffected");

    m.reset();
    assert.equal(
      m.snapshot("svc-b").total,
      0,
      "Global reset should clear svc-b",
    );
  }

  // ── 5. Independent service namespaces don't bleed into each other ──────
  {
    const m = new SlidingWindowMetrics(10);
    m.record("svc-x", true, 100, 500);
    m.record("svc-y", false, 100, 500);

    assert.equal(m.snapshot("svc-x").failed, 1);
    assert.equal(m.snapshot("svc-y").failed, 0);
  }

  console.log("✔ [UNIT] SlidingWindowMetrics tests passed");
}
