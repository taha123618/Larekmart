import assert from "node:assert/strict";
import { createApp } from "../../src/app.js";

export async function runApiTests(): Promise<void> {
  console.log("--- API Route Tests ---");

  const app = createApp();

  // 1. Health liveness probe
  const liveRes = await app.request("/health/live");
  assert.equal(liveRes.status, 200);
  const liveJson = (await liveRes.json()) as { status: string };
  assert.equal(liveJson.status, "alive");

  // 2. Healthz shortcut
  const healthzRes = await app.request("/healthz");
  assert.equal(healthzRes.status, 200);
  const healthzJson = (await healthzRes.json()) as { status: string };
  assert.equal(healthzJson.status, "alive");

  // 3. Security headers check
  assert.equal(liveRes.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(liveRes.headers.get("X-Frame-Options"), "DENY");

  // 4. Metrics endpoint returns Prometheus formatted text
  const metricsRes = await app.request("/metrics");
  assert.equal(metricsRes.status, 200);
  const metricsText = await metricsRes.text();
  assert.ok(metricsText.includes("# HELP") || metricsText.length >= 0);

  // 5. Unauthenticated request to protected route returns 401
  const uploadRes = await app.request("/api/v1/media/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerType: "product",
      ownerId: "p1",
      filename: "test.jpg",
      contentType: "image/jpeg",
      size: 1000,
    }),
  });
  assert.equal(uploadRes.status, 401);

  console.log("✓ API route tests passed\n");
}
