import assert from "node:assert/strict";
import {
  CanaryProber,
  InMemoryCanaryStorage,
  SYNTHETIC_PROBE_HEADER,
} from "../src/canary/index.js";

async function runTests() {
  console.log("==================================================");
  console.log("⚡ @repo/monitoring Automated Synthetic Canary Tests");
  console.log("==================================================");

  // 1. Fast Read Scenario Happy Path
  console.log("\n1. Testing Fast Read Scenario (Happy Path)...");
  const prober = new CanaryProber();

  const mockSuccessFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const urlStr = String(url);
    const headers = init?.headers as Record<string, string>;
    assert.equal(
      headers?.[SYNTHETIC_PROBE_HEADER],
      "true",
      "Synthetic probe header must be propagated",
    );

    if (urlStr.includes("/api/v1/home")) {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }
    if (urlStr.includes("/api/v1/catalog/products")) {
      return new Response(JSON.stringify({ products: [] }), { status: 200 });
    }
    if (urlStr.includes("/availability")) {
      return new Response(JSON.stringify({ available: 10 }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;

  const readRun1 = await prober.runReadProbe("http://mock-gateway", {
    fetchFn: mockSuccessFetch,
  });

  assert.equal(readRun1.success, true, "Read probe must succeed");
  assert.equal(readRun1.steps.length, 3, "Read probe must execute 3 steps");
  assert.equal(readRun1.consecutiveFailures, 0);
  assert.ok(readRun1.totalDurationMs >= 0);
  console.log(
    `  ✓ Fast read probe completed in ${readRun1.totalDurationMs}ms with 3/3 steps passing`,
  );

  // 2. Fast Read Scenario Failure Handling
  console.log("\n2. Testing Fast Read Scenario with OpenSearch Degradation...");
  const mockDegradedFetch = (async (url: string | URL | Request) => {
    const urlStr = String(url);
    if (urlStr.includes("/api/v1/home")) {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }
    if (urlStr.includes("/api/v1/catalog/products")) {
      return new Response(JSON.stringify({ error: "OpenSearch timeout" }), {
        status: 504,
      });
    }
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;

  const readRun2 = await prober.runReadProbe("http://mock-gateway", {
    fetchFn: mockDegradedFetch,
  });

  assert.equal(
    readRun2.success,
    false,
    "Degraded search must mark probe failed",
  );
  assert.equal(
    readRun2.steps.length,
    2,
    "Steps must abort after step 2 failure",
  );
  assert.equal(
    readRun2.consecutiveFailures,
    1,
    "Consecutive failures must increment to 1",
  );
  assert.ok(readRun2.error?.includes("HTTP 504"));
  console.log(
    "  ✓ Fast read degradation safely recorded and step execution short-circuited",
  );

  // 3. Consecutive Failure Increment
  console.log("\n3. Testing Consecutive Failure Counter...");
  const readRun3 = await prober.runReadProbe("http://mock-gateway", {
    fetchFn: mockDegradedFetch,
  });
  assert.equal(
    readRun3.consecutiveFailures,
    2,
    "Second failure must increment counter to 2",
  );
  console.log(
    "  ✓ Consecutive failure reached 2 (ready to trigger Alertmanager P1 rule)",
  );

  // 4. Consecutive Failure Reset on Success
  console.log("\n4. Testing Counter Reset on Recovery...");
  const readRun4 = await prober.runReadProbe("http://mock-gateway", {
    fetchFn: mockSuccessFetch,
  });
  assert.equal(readRun4.success, true);
  assert.equal(
    readRun4.consecutiveFailures,
    0,
    "Counter must reset to 0 upon recovery",
  );
  console.log("  ✓ Consecutive failure counter successfully reset to 0");

  // 5. Transactional Checkout Scenario Happy Path
  console.log("\n5. Testing Transactional Checkout Scenario (Happy Path)...");
  let cleanupExecuted = false;

  const mockCheckoutFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const urlStr = String(url);
    if (urlStr.includes("/availability")) {
      return new Response(JSON.stringify({ available: 5 }), { status: 200 });
    }
    if (urlStr.includes("/inventory/reservations") && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "RESERVED" }), {
        status: 202,
      });
    }
    if (urlStr.includes("/orders/cod") && init?.method === "POST") {
      return new Response(JSON.stringify({ orderId: "ord_canary_001" }), {
        status: 201,
      });
    }
    if (
      urlStr.includes("/inventory/reservations") &&
      init?.method === "DELETE"
    ) {
      cleanupExecuted = true;
      return new Response(JSON.stringify({ released: true }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;

  const checkoutRun = await prober.runCheckoutProbe("http://mock-gateway", {
    fetchFn: mockCheckoutFetch,
  });

  assert.equal(checkoutRun.success, true, "Checkout scenario must succeed");
  assert.equal(
    checkoutRun.steps.length,
    4,
    "Must execute all 4 checkout lifecycle steps",
  );
  assert.equal(
    cleanupExecuted,
    true,
    "Auto-cleanup compensation step must be called",
  );
  console.log(
    `  ✓ Transactional checkout completed in ${checkoutRun.totalDurationMs}ms with auto-cleanup verified`,
  );

  // 6. SLA Statistics & Percentile Math
  console.log("\n6. Testing SLA Statistics and Percentile Math...");
  const storage = new InMemoryCanaryStorage();
  const slaProber = new CanaryProber(storage);

  // Run 19 successes and 1 failure (95% SLA)
  for (let i = 0; i < 19; i++) {
    await slaProber.runReadProbe("http://mock-gateway", {
      fetchFn: mockSuccessFetch,
    });
  }
  await slaProber.runReadProbe("http://mock-gateway", {
    fetchFn: mockDegradedFetch,
  });

  const sla = await slaProber.calculateSla("read");
  assert.equal(sla.totalRuns, 20);
  assert.equal(sla.successfulRuns, 19);
  assert.equal(sla.failedRuns, 1);
  assert.equal(sla.slaPercentage, 95);
  assert.ok(sla.avgDurationMs > 0);
  assert.ok(sla.p95DurationMs > 0);
  console.log(
    `  ✓ SLA stats calculated: ${sla.slaPercentage}% uptime across ${sla.totalRuns} runs (P95: ${sla.p95DurationMs}ms)`,
  );

  console.log("\n==================================================");
  console.log("🎉 All Synthetic Canary Prober Tests Passed Cleanly!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
