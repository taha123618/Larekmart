import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../src/app.js";

function createTestToken(payload: object) {
  const hmacKey =
    process.env.CLERK_JWT_HMAC_KEY || "larekmart_seller_hmac_secret_dev_key";
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", hmacKey)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export async function runCanaryAdminTests() {
  console.log("▶ [INTEGRATION] Running Gateway Canary Admin API tests...");

  const app = await buildApp();

  const adminToken = createTestToken({
    sub: "usr_admin_canary_01",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const customerToken = createTestToken({
    sub: "usr_cust_canary_01",
    role: "customer",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  // 1. Unauthenticated request rejected with 401
  const res1 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/canary/runs",
  });
  assert.equal(res1.statusCode, 401, "Unauthenticated request must be 401");

  // 2. Customer request rejected with 403
  const res2 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/canary/runs",
    headers: {
      authorization: `Bearer ${customerToken}`,
    },
  });
  assert.equal(res2.statusCode, 403, "Non-admin request must be 403");

  // 3. Admin request to list runs
  const res3 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/canary/runs",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res3.statusCode, 200, "Admin can list canary runs");
  const body3 = JSON.parse(res3.payload);
  assert.equal(body3.success, true);
  assert.ok(Array.isArray(body3.data));

  // 4. Admin request for SLA stats
  const res4 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/canary/sla",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res4.statusCode, 200, "Admin can retrieve SLA stats");
  const body4 = JSON.parse(res4.payload);
  assert.equal(body4.success, true);
  assert.ok(body4.data);
  assert.ok(body4.data.read);
  assert.ok(body4.data.checkout);

  // 5. Admin triggers a read probe
  const res5 = await app.inject({
    method: "POST",
    url: "/api/v1/admin/canary/trigger",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      scenario: "read",
    },
  });
  assert.equal(res5.statusCode, 200, "Admin can trigger canary probe");
  const body5 = JSON.parse(res5.payload);
  assert.equal(body5.success, true);
  assert.ok(body5.data);
  assert.equal(body5.data.scenario, "read");
  assert.ok(typeof body5.data.totalDurationMs === "number");
  assert.ok(Array.isArray(body5.data.steps));

  // 6. Admin triggers with invalid scenario returns 400
  const res6 = await app.inject({
    method: "POST",
    url: "/api/v1/admin/canary/trigger",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      scenario: "unsupported_scenario",
    },
  });
  assert.equal(res6.statusCode, 400, "Invalid scenario must return 400");

  console.log("✔ [INTEGRATION] Gateway Canary Admin API tests passed successfully!");
}
