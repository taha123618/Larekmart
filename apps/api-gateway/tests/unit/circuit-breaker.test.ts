import assert from "node:assert/strict";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";

export async function runCircuitBreakerTests() {
  console.log("▶ [UNIT] Running Circuit Breaker tests...");

  const cb = new CircuitBreaker({
    failureThreshold: 3,
    cooldownPeriodMs: 100, // short cooldown for fast testing
    successThreshold: 2,
  });

  const service = "test-service";

  // Initially CLOSED and available
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // Record 2 failures (below threshold of 3)
  cb.recordFailure(service);
  cb.recordFailure(service);
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // 3rd failure trips circuit to OPEN
  cb.recordFailure(service);
  assert.equal(cb.getState(service), "OPEN");
  assert.equal(cb.isAvailable(service), false);

  // Wait for cooldown to expire
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Accessing it transitions to HALF_OPEN
  assert.equal(cb.getState(service), "HALF_OPEN");
  assert.ok(cb.isAvailable(service));

  // 1 success in HALF_OPEN (threshold is 2)
  cb.recordSuccess(service);
  assert.equal(cb.getState(service), "HALF_OPEN");

  // 2nd success in HALF_OPEN resets to CLOSED
  cb.recordSuccess(service);
  assert.equal(cb.getState(service), "CLOSED");
  assert.ok(cb.isAvailable(service));

  // Trip again and fail in HALF_OPEN
  cb.recordFailure(service);
  cb.recordFailure(service);
  cb.recordFailure(service);
  assert.equal(cb.getState(service), "OPEN");

  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(cb.getState(service), "HALF_OPEN");

  // Failure in HALF_OPEN trips immediately back to OPEN
  cb.recordFailure(service);
  assert.equal(cb.getState(service), "OPEN");
  assert.equal(cb.isAvailable(service), false);

  console.log("✔ [UNIT] Circuit Breaker tests passed");
}
