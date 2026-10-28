import assert from "assert";
import crypto from "node:crypto";
import { UpdateShipmentLocationSchema } from "@repo/types";
import { WebhookService } from "../src/services/webhook.service.js";
import { requireAdminOrInternal } from "../src/middleware/auth.middleware.js";

async function runSecurityTests() {
  console.log("=== Shipping Service Security Tests ===");

  // 1. Test Timing-Safe Webhook Signature Verification
  console.log("1. Testing Webhook Signature Verification (timingSafeEqual)...");
  process.env.NODE_ENV = "production";
  process.env.WEBHOOK_SECRET = "production_secret_token_123456789";

  const valid = WebhookService.verifySignature(
    "tcs",
    "production_secret_token_123456789",
  );
  assert.equal(valid, true, "Valid webhook signature should be accepted");

  const invalid = WebhookService.verifySignature(
    "tcs",
    "forged_secret_token_987654321",
  );
  assert.equal(invalid, false, "Tampered webhook signature must be rejected");

  const missing = WebhookService.verifySignature("tcs", undefined);
  assert.equal(missing, false, "Missing webhook signature must be rejected");

  const empty = WebhookService.verifySignature("tcs", "");
  assert.equal(empty, false, "Empty webhook signature must be rejected");

  console.log("✓ Webhook signature timingSafeEqual verification verified");

  // 1b. Regression: unsigned webhooks must be rejected in EVERY environment.
  // The pre-fix code returned true for a missing signature whenever NODE_ENV
  // was development/test — and NODE_ENV defaults to development.
  console.log("1b. Testing unsigned-webhook rejection across environments...");
  for (const envMode of ["development", "test", "production"]) {
    process.env.NODE_ENV = envMode;
    const unsigned = WebhookService.verifySignature("tcs", undefined);
    assert.equal(
      unsigned,
      false,
      `Unsigned webhook must be rejected in ${envMode} mode`,
    );
  }

  // 1c. Regression: the schema-default placeholder secret must never
  // authenticate, in any environment.
  for (const envMode of ["development", "test", "production"]) {
    process.env.NODE_ENV = envMode;
    const placeholder = WebhookService.verifySignature(
      "tcs",
      "shipping_wh_secret_change_me",
    );
    assert.equal(
      placeholder,
      false,
      `Placeholder WEBHOOK_SECRET must be rejected in ${envMode} mode`,
    );
  }
  process.env.NODE_ENV = "production";

  console.log("✓ No fail-open branch exists in any environment");

  // 2. Test requireAdminOrInternal Middleware
  console.log("2. Testing requireAdminOrInternal authorization middleware...");
  process.env.INTERNAL_SERVICE_SECRET = "internal_secret_key_abc";

  // Case A: Internal secret matches
  let nextCalled = false;
  const mockCtxInternal = {
    headers: { "x-internal-secret": "internal_secret_key_abc" },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxInternal, async () => {
    nextCalled = true;
  });
  assert.equal(
    nextCalled,
    true,
    "Internal service secret match must allow request",
  );

  // Case A2: Gateway forwards regular user role with internal secret -> MUST reject 403
  nextCalled = false;
  const mockCtxGatewayUser = {
    headers: {
      "x-internal-secret": "internal_secret_key_abc",
      "x-user-role": "user",
      "x-user-id": "user_normal",
    },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxGatewayUser, async () => {
    nextCalled = true;
  });
  assert.equal(
    nextCalled,
    false,
    "Gateway forwarded user role must NOT have admin access",
  );
  assert.equal(
    mockCtxGatewayUser.status,
    403,
    "Expected 403 Forbidden for gateway user",
  );

  // Case B: No secret and no auth in production
  nextCalled = false;
  const mockCtxUnauth = {
    headers: {},
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxUnauth, async () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false, "Unauthenticated request must be blocked");
  assert.equal(mockCtxUnauth.status, 401, "Expected 401 Unauthorized status");

  // Case C: Standard user claims (non-admin)
  process.env.NODE_ENV = "test";
  nextCalled = false;
  const userPayload = Buffer.from(
    JSON.stringify({ sub: "user_123", metadata: { role: "user" } }),
  ).toString("base64url");
  const mockCtxUser = {
    headers: { authorization: `Bearer header.${userPayload}.signature` },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxUser, async () => {
    nextCalled = true;
  });
  // In shipping-service, standard user cannot manage shipments
  assert.equal(
    nextCalled,
    false,
    "Standard user must be blocked from admin shipment routes",
  );
  assert.equal(mockCtxUser.status, 403, "Expected 403 Forbidden for non-admin");

  // Case D: Admin claims in dev/test environment
  nextCalled = false;
  const adminPayload = Buffer.from(
    JSON.stringify({ sub: "admin_456", metadata: { role: "admin" } }),
  ).toString("base64url");
  const mockCtxAdmin = {
    headers: { authorization: `Bearer header.${adminPayload}.signature` },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxAdmin, async () => {
    nextCalled = true;
  });
  assert.equal(
    nextCalled,
    true,
    "Admin claims must allow request in test environment",
  );
  assert.equal(mockCtxAdmin.state.userId, "admin_456");
  assert.equal(mockCtxAdmin.state.userRole, "admin");

  // Case D2: In production without signing keys, unverified token must fail closed (401)
  process.env.NODE_ENV = "production";
  nextCalled = false;
  const mockCtxProdUnverified = {
    headers: { authorization: `Bearer header.${adminPayload}.signature` },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxProdUnverified, async () => {
    nextCalled = true;
  });
  assert.equal(
    nextCalled,
    false,
    "Unverified token in production must be rejected",
  );
  assert.equal(
    mockCtxProdUnverified.status,
    401,
    "Expected 401 when key is missing in production",
  );

  // Case E: Cryptographic JWT signature verification when CLERK_SECRET_KEY is configured
  console.log("3. Testing cryptographic JWT signature verification...");
  process.env.CLERK_SECRET_KEY = "test_clerk_hmac_secret_key_12345";

  const headerB64 = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payloadB64 = Buffer.from(
    JSON.stringify({ sub: "admin_crypt", metadata: { role: "admin" } }),
  ).toString("base64url");
  const validSig = crypto
    .createHmac("sha256", process.env.CLERK_SECRET_KEY)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  // Valid signed token
  nextCalled = false;
  const mockCtxValidSigned = {
    headers: { authorization: `Bearer ${headerB64}.${payloadB64}.${validSig}` },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxValidSigned, async () => {
    nextCalled = true;
  });
  assert.equal(
    nextCalled,
    true,
    "Cryptographically signed JWT must be accepted",
  );
  assert.equal(mockCtxValidSigned.state.userId, "admin_crypt");

  // Forged signature
  nextCalled = false;
  const mockCtxForged = {
    headers: {
      authorization: `Bearer ${headerB64}.${payloadB64}.forged_signature_xyz`,
    },
    state: {},
  } as any;
  await requireAdminOrInternal(mockCtxForged, async () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false, "Forged signature must be rejected");
  assert.equal(mockCtxForged.status, 401, "Expected 401 for forged signature");
  delete process.env.CLERK_SECRET_KEY;

  // 4. Test HMAC-SHA256 Webhook Payload Binding
  console.log("4. Testing Webhook HMAC-SHA256 Payload Binding...");
  const rawPayload = JSON.stringify({
    trackingNumber: "TRK123456",
    status: "DELIVERED",
  });
  const validHmac = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(rawPayload)
    .digest("hex");

  const hmacValid = WebhookService.verifySignature(
    "tcs",
    validHmac,
    rawPayload,
  );
  assert.equal(hmacValid, true, "Valid HMAC over raw payload must be accepted");

  const tamperedPayload = JSON.stringify({
    trackingNumber: "TRK123456",
    status: "FAILED",
  });
  const hmacTampered = WebhookService.verifySignature(
    "tcs",
    validHmac,
    tamperedPayload,
  );
  assert.equal(hmacTampered, false, "Tampered payload must be rejected");

  // 5. Test Geolocation Telemetry Schema Validation & Coordinate Boundary Enforcement
  console.log(
    "5. Testing Geolocation Telemetry Schema Validation & Coordinate Bounds...",
  );
  const validLocationPayload = {
    shipmentId: "ship_test_123",
    latitude: 24.8607,
    longitude: 67.0011,
    heading: 120,
    accuracyMeters: 5,
    etaMinutes: 45,
    location: "Karachi Central Logistics Hub",
    description: "Package en route with courier rider",
    status: "OUT_FOR_DELIVERY",
  };
  const parsed = UpdateShipmentLocationSchema.safeParse(validLocationPayload);
  assert.equal(
    parsed.success,
    true,
    "Valid geolocation payload must pass schema parsing",
  );
  if (parsed.success) {
    assert.equal(parsed.data.latitude, 24.8607);
    assert.equal(parsed.data.longitude, 67.0011);
    assert.equal(parsed.data.status, "OUT_FOR_DELIVERY");
  }

  // Reject out-of-bounds latitude (> 90)
  const invalidLat = UpdateShipmentLocationSchema.safeParse({
    ...validLocationPayload,
    latitude: 95.0,
  });
  assert.equal(invalidLat.success, false, "Latitude > 90 must fail validation");

  // Reject out-of-bounds longitude (< -180)
  const invalidLng = UpdateShipmentLocationSchema.safeParse({
    ...validLocationPayload,
    longitude: -195.0,
  });
  assert.equal(
    invalidLng.success,
    false,
    "Longitude < -180 must fail validation",
  );

  // Reject invalid heading (> 360)
  const invalidHeading = UpdateShipmentLocationSchema.safeParse({
    ...validLocationPayload,
    heading: 420,
  });
  assert.equal(
    invalidHeading.success,
    false,
    "Heading > 360 must fail validation",
  );

  // Reject missing location string
  const missingLocation = UpdateShipmentLocationSchema.safeParse({
    latitude: 24.8607,
    longitude: 67.0011,
  });
  assert.equal(
    missingLocation.success,
    false,
    "Missing location text must fail validation",
  );

  console.log(
    "✓ Geolocation coordinate boundary & schema validation tests passed",
  );

  console.log("All shipping-service security tests passed successfully!\n");
  process.exit(0);
}

runSecurityTests().catch((err) => {
  console.error("Security test failed:", err);
  process.exit(1);
});
