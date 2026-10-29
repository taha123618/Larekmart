/**
 * Chaos Resilience & Adaptive Rate-Limiting Guardrails Tests
 *
 * Validates that API Gateway enforces adaptive rate-limiting and in-flight
 * concurrency bulkheads when downstream services (order-service, tax-service,
 * inventory-service) experience chaos or circuit-breaker trips.
 */

import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  InFlightBulkhead,
  inFlightBulkhead,
} from "../../src/resilience/in-flight-bulkhead.js";
import { getAdaptiveRateLimitForRoute } from "../../src/gateway/policies.js";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";
import {
  registerRateLimitMiddleware,
  isDownstreamDegraded,
} from "../../src/middleware/rate-limit.js";

export async function runChaosGuardrailsTests() {
  console.log(
    "▶ [RESILIENCE] Running Chaos Guardrails & Adaptive Rate-Limiting tests...",
  );

  // ── 1. In-Flight Bulkhead Slot Acquisition & Concurrency Caps ───────────────
  {
    const bulkhead = new InFlightBulkhead();
    const category = "checkout";

    // Healthy max = 50, Degraded max = 5
    assert.equal(InFlightBulkhead.getMaxConcurrent(category, false), 50);
    assert.equal(InFlightBulkhead.getMaxConcurrent(category, true), 5);

    // Simulate 5 concurrent acquisitions under degraded conditions
    for (let i = 0; i < 5; i++) {
      const acquired = bulkhead.acquire(category, 5);
      assert.equal(acquired, true, `Acquisition ${i + 1} should succeed`);
    }
    assert.equal(bulkhead.getActive(category), 5);

    // 6th concurrent request must be shed
    const sixth = bulkhead.acquire(category, 5);
    assert.equal(
      sixth,
      false,
      "6th request under degraded conditions must be shed",
    );

    // Release one slot
    bulkhead.release(category);
    assert.equal(bulkhead.getActive(category), 4);

    // Now another slot can be acquired
    const retry = bulkhead.acquire(category, 5);
    assert.equal(retry, true, "Should acquire slot after release");
    console.log(
      "  ✓ InFlightBulkhead concurrency limits and shedding verified",
    );
  }

  // ── 2. Adaptive Policy Clamping Under Downstream Chaos ──────────────────────
  {
    // Normal healthy condition
    const healthyPolicy = getAdaptiveRateLimitForRoute(
      "/api/v1/checkout",
      false,
    );
    assert.equal(
      healthyPolicy.limit,
      30,
      "Normal checkout rate limit should be 30 req/min",
    );
    assert.equal(healthyPolicy.degraded, undefined);

    // Degraded / Chaos condition
    const degradedPolicy = getAdaptiveRateLimitForRoute(
      "/api/v1/checkout",
      true,
    );
    assert.equal(
      degradedPolicy.limit,
      5,
      "Degraded checkout rate limit should clamp to 5 req/min",
    );
    assert.equal(degradedPolicy.degraded, true);

    // Non-transactional routes must not be throttled by checkout chaos
    const catalogPolicy = getAdaptiveRateLimitForRoute(
      "/api/v1/catalog/products",
      true,
    );
    assert.equal(
      catalogPolicy.limit,
      300,
      "Catalog reads should remain at 300 req/min",
    );
    console.log("  ✓ Adaptive policy route discrimination verified");
  }

  // ── 3. Circuit Breaker Degradation Detection ─────────────────────────────────
  {
    const mockCb = new CircuitBreaker();
    const services = [
      "order-service",
      "tax-service",
      "inventory-service",
      "payment-service",
    ];

    // Initially all closed
    assert.equal(
      isDownstreamDegraded(services, mockCb),
      false,
      "All closed should be healthy",
    );

    // Simulate MySQL chaos on tax-service causing circuit breaker to trip
    mockCb.feedUpstreamRetryAfter("tax-service", 30);
    assert.equal(mockCb.getState("tax-service"), "OPEN");
    assert.equal(
      isDownstreamDegraded(services, mockCb),
      true,
      "Open tax-service trips degradation flag",
    );

    // Reset tax-service
    mockCb.reset("tax-service");
    assert.equal(
      isDownstreamDegraded(services, mockCb),
      false,
      "Reset returns to healthy",
    );
    console.log("  ✓ Circuit breaker degradation detector verified");
  }

  // ── 4. End-to-End Fastify In-Flight Shedding & 503 Retry-After ───────────────
  {
    const app = Fastify();
    await registerRateLimitMiddleware(app);

    app.post("/checkout/orders", async () => {
      return { success: true };
    });

    await app.ready();

    // Fill in-flight bulkhead capacity to simulate active saturation
    inFlightBulkhead.reset();
    for (let i = 0; i < 50; i++) {
      inFlightBulkhead.acquire("checkout", 50);
    }

    // 51st request must receive 503 Service Unavailable with Retry-After header
    const response = await app.inject({
      method: "POST",
      url: "/checkout/orders",
      headers: {
        "x-request-id": "req-chaos-test-01",
      },
    });

    assert.equal(response.statusCode, 503, "Shed request must return HTTP 503");
    assert.equal(
      response.headers["retry-after"],
      "15",
      "Shed request must include Retry-After header",
    );
    const body = JSON.parse(response.body);
    assert.equal(body.error, "Service Unavailable");
    assert.equal(body.retryAfter, 15);

    // Cleanup bulkhead
    inFlightBulkhead.reset();
    await app.close();
    console.log(
      "  ✓ Fastify in-flight bulkhead 503 shedding and Retry-After header verified",
    );
  }

  console.log(
    "  ✓ All Chaos Resilience & Adaptive Rate-Limiting tests passed cleanly!",
  );
}
