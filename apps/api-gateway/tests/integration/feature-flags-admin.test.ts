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

export async function runFeatureFlagsAdminTests() {
  console.log(
    "▶ [INTEGRATION] Running Gateway Feature Flags Admin API tests...",
  );

  const app = await buildApp();

  const adminToken = createTestToken({
    sub: "usr_admin_ff_01",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const customerToken = createTestToken({
    sub: "usr_cust_ff_01",
    role: "customer",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  // 1. Unauthenticated request rejected with 401
  const res1 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/feature-flags",
  });
  assert.equal(res1.statusCode, 401, "Unauthenticated request must be 401");

  // 2. Customer request rejected with 403
  const res2 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/feature-flags",
    headers: {
      authorization: `Bearer ${customerToken}`,
    },
  });
  assert.equal(res2.statusCode, 403, "Non-admin user must be 403");

  // 3. Admin creates feature flag
  const flagKey = `gateway.checkout_v2_${Date.now()}`;
  const res3 = await app.inject({
    method: "POST",
    url: "/api/v1/admin/feature-flags",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      key: flagKey,
      enabled: true,
      defaultValue: false,
      variations: {
        control: false,
        treatment: true,
      },
      rollout: {
        percentage: 30,
        trueVariation: "treatment",
        falseVariation: "control",
      },
      description: "Gateway canary rollout for Checkout v2",
    },
  });
  assert.equal(res3.statusCode, 200, "Flag creation must return 200");
  const body3 = JSON.parse(res3.payload);
  assert.equal(body3.success, true);
  assert.equal(body3.data.key, flagKey);

  // 4. Admin retrieves list of feature flags
  const res4 = await app.inject({
    method: "GET",
    url: "/api/v1/admin/feature-flags",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res4.statusCode, 200);
  const body4 = JSON.parse(res4.payload);
  assert.ok(body4.data.some((f: any) => f.key === flagKey));

  // 5. Admin retrieves single feature flag
  const res5 = await app.inject({
    method: "GET",
    url: `/api/v1/admin/feature-flags/${flagKey}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res5.statusCode, 200);
  const body5 = JSON.parse(res5.payload);
  assert.equal(body5.data.key, flagKey);
  assert.equal(body5.data.enabled, true);

  // 6. Admin toggles flag
  const res6 = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/feature-flags/${flagKey}/toggle`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      enabled: false,
    },
  });
  assert.equal(res6.statusCode, 200);
  const body6 = JSON.parse(res6.payload);
  assert.equal(body6.enabled, false);

  // 7. Admin updates rollout percentage
  const res7 = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/feature-flags/${flagKey}/rollout`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      percentage: 75,
    },
  });
  assert.equal(res7.statusCode, 200);
  const body7 = JSON.parse(res7.payload);
  assert.equal(body7.percentage, 75);

  // 8. Admin tests simulation evaluation
  const res8 = await app.inject({
    method: "POST",
    url: `/api/v1/admin/feature-flags/${flagKey}/evaluate`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      context: {
        targetingKey: "user_sim_test_01",
      },
    },
  });
  assert.equal(res8.statusCode, 200);
  const body8 = JSON.parse(res8.payload);
  assert.equal(body8.success, true);
  assert.equal(body8.data.flagKey, flagKey);

  // 9. Admin deletes feature flag
  const res9 = await app.inject({
    method: "DELETE",
    url: `/api/v1/admin/feature-flags/${flagKey}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res9.statusCode, 200);
  const body9 = JSON.parse(res9.payload);
  assert.equal(body9.success, true);

  // 10. Subsequent GET returns 404
  const res10 = await app.inject({
    method: "GET",
    url: `/api/v1/admin/feature-flags/${flagKey}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res10.statusCode, 404);

  console.log("  ✓ All Feature Flags Admin endpoints verified cleanly!");
}
