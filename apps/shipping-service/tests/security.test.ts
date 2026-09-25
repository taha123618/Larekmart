import assert from "assert";
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

  // Case D: Admin claims
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
  assert.equal(nextCalled, true, "Admin claims must allow request");
  assert.equal(mockCtxAdmin.state.userId, "admin_456");
  assert.equal(mockCtxAdmin.state.userRole, "admin");

  console.log("All shipping-service security tests passed successfully!\n");
  process.exit(0);
}

runSecurityTests().catch((err) => {
  console.error("Security test failed:", err);
  process.exit(1);
});
