import assert from "node:assert/strict";
import { buildApp } from "../../src/app.js";

export async function runHealthIntegrationTests() {
  console.log("▶ [INTEGRATION] Running Gateway Health & Endpoint integration tests...");

  const app = await buildApp();

  // Test 1: Liveness /health
  const res1 = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.equal(res1.statusCode, 200);
  const body1 = JSON.parse(res1.payload);
  assert.equal(body1.status, "ok");
  assert.equal(body1.service, "api-gateway");

  // Test 2: Liveness /health/live
  const res2 = await app.inject({
    method: "GET",
    url: "/health/live",
  });
  assert.equal(res2.statusCode, 200);
  const body2 = JSON.parse(res2.payload);
  assert.equal(body2.status, "ok");

  // Test 3: Readiness /health/ready
  const res3 = await app.inject({
    method: "GET",
    url: "/health/ready",
  });
  assert.equal(res3.statusCode, 200);
  const body3 = JSON.parse(res3.payload);
  assert.equal(body3.status, "ready");
  assert.equal(body3.service, "api-gateway");

  // Test 4: Prometheus /metrics
  const res4 = await app.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(res4.statusCode, 200);
  assert.ok(
    res4.headers["content-type"]?.includes("text/plain"),
    "Metrics must return text/plain",
  );
  assert.ok(
    res4.payload.includes("gateway_requests_total"),
    "Metrics should output gateway_requests_total",
  );

  // Test 5: Aggregation /api/v1/home (handles offline upstreams gracefully without crashing)
  const res5 = await app.inject({
    method: "GET",
    url: "/api/v1/home",
  });
  assert.equal(res5.statusCode, 200);
  const homeBody = JSON.parse(res5.payload);
  assert.ok(Array.isArray(homeBody.featured), "featured must be an array");
  assert.ok(Array.isArray(homeBody.categories), "categories must be an array");
  assert.ok(Array.isArray(homeBody.recommendations), "recommendations must be an array");
  assert.ok(homeBody.requestId, "Response must include requestId");

  await app.close();
  console.log("✔ [INTEGRATION] Gateway Health & Endpoint integration tests passed");
}
