/**
 * Circuit Breaker — Legacy Consecutive-Failure Behaviour (now via sliding window)
 *
 * These tests verify that the circuit still trips when all calls within
 * the window are failures, using the same observable contract as before.
 * The new circuit uses a sliding window; failureThreshold ≥ minWindowCalls
 * and failureRateThreshold=1.0 replicates the old consecutive-failure gate.
 */

import assert from "node:assert/strict";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";

export async function runCircuitBreakerTests() {
  console.log("▶ [UNIT] Running Circuit Breaker (legacy behaviour) tests...");

  const cb = new CircuitBreaker({
    minWindowCalls: 3, // trip after at least 3 calls
    failureRateThreshold: 1.0, // 100% failure rate required → strictly consecutive
    halfOpenInitialMs: 400,
    halfOpenMaxMs: 800,
    successThreshold: 2,
  });

  const service = "test-service";

  // Initially CLOSED and available
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // Record 2 failures (below minWindowCalls of 3)
  cb.recordFailure(service, 50);
  cb.recordFailure(service, 50);
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // 3rd failure at 100% rate trips circuit to OPEN
  cb.recordFailure(service, 50);
  assert.equal(cb.getState(service), "OPEN");
  assert.equal(cb.isAvailable(service), false);

  // Wait for cooldown to expire
  await new Promise((resolve) => setTimeout(resolve, 450));

  // Accessing it transitions to HALF_OPEN
  assert.equal(cb.getState(service), "HALF_OPEN");
  assert.ok(cb.isAvailable(service));

  // 1 success in HALF_OPEN (threshold is 2)
  cb.recordSuccess(service, 50);
  assert.equal(cb.getState(service), "HALF_OPEN");

  // 2nd success in HALF_OPEN resets to CLOSED
  cb.recordSuccess(service, 50);
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // Trip again
  cb.recordFailure(service, 50);
  cb.recordFailure(service, 50);
  cb.recordFailure(service, 50);
  assert.equal(cb.getState(service), "OPEN");

  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(cb.getState(service), "HALF_OPEN");

  // Failure in HALF_OPEN trips immediately back to OPEN
  cb.recordFailure(service, 50);
  assert.equal(cb.getState(service), "OPEN");
  assert.equal(cb.isAvailable(service), false);

  console.log("✔ [UNIT] Circuit Breaker (legacy behaviour) tests passed");
}
