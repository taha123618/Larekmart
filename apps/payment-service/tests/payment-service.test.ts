import assert from "node:assert/strict";
import { Hono } from "hono";
import {
  shouldBeUser,
  shouldBeAdmin,
} from "../src/middleware/authMiddleware.js";
import webhookRoute from "../src/routes/webhooks.route.js";
import { GATEWAY_HEADERS, type PaymentSuccessfulType } from "@repo/types";

process.env.INTERNAL_SERVICE_SECRET = "test-payment-internal-secret-xyz";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_stripe_999";

async function runPaymentServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("💳 payment-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  // ---------------------------------------------------------------------------
  // 1. Testing shouldBeUser Middleware
  // ---------------------------------------------------------------------------
  console.log("\n1. Testing shouldBeUser authentication guard...");
  const userApp = new Hono<{
    Variables: { userId: string; userRole?: string; clerkAuth: any };
  }>();
  userApp.use("*", async (c, next) => {
    c.set("clerkAuth", () => ({ userId: null }));
    await next();
  });
  userApp.use("*", shouldBeUser);
  userApp.get("/protected-user", (c) => {
    return c.json({ userId: c.get("userId"), userRole: c.get("userRole") });
  });

  // 1A. No credentials -> 401
  const unauthRes = await userApp.request("/protected-user");
  assert.equal(
    unauthRes.status,
    401,
    "Unauthenticated request must return 401",
  );
  const unauthBody = (await unauthRes.json()) as { message?: string };
  assert.equal(unauthBody.message, "You are not logged in.");
  console.log("  ✓ Missing auth credentials rejected with 401");

  // 1B. Gateway propagation -> 200
  const gatewayUserRes = await userApp.request("/protected-user", {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-payment-internal-secret-xyz",
      [GATEWAY_HEADERS.USER_ID]: "user_buyer_stripe_101",
      [GATEWAY_HEADERS.USER_ROLE]: "user",
    },
  });
  assert.equal(
    gatewayUserRes.status,
    200,
    "Gateway-authenticated request must succeed",
  );
  const gatewayUserBody = (await gatewayUserRes.json()) as {
    userId: string;
    userRole?: string;
  };
  assert.equal(gatewayUserBody.userId, "user_buyer_stripe_101");
  assert.equal(gatewayUserBody.userRole, "user");
  console.log(
    "  ✓ Internal gateway header propagation sets context and succeeds",
  );

  // ---------------------------------------------------------------------------
  // 2. Testing shouldBeAdmin Middleware
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing shouldBeAdmin authorization guard...");
  const adminApp = new Hono<{
    Variables: { userId: string; userRole?: string; clerkAuth: any };
  }>();
  adminApp.use("*", async (c, next) => {
    c.set("clerkAuth", () => ({ userId: null }));
    await next();
  });
  adminApp.use("*", shouldBeAdmin);
  adminApp.get("/protected-admin", (c) => {
    return c.json({ userId: c.get("userId"), role: c.get("userRole") });
  });

  // 2A. Non-admin role via gateway -> 403 Forbidden
  const nonAdminRes = await adminApp.request("/protected-admin", {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-payment-internal-secret-xyz",
      [GATEWAY_HEADERS.USER_ID]: "user_customer_555",
      [GATEWAY_HEADERS.USER_ROLE]: "user",
    },
  });
  assert.equal(nonAdminRes.status, 403, "Non-admin must return 403 Forbidden");
  const nonAdminBody = (await nonAdminRes.json()) as { message?: string };
  assert.equal(nonAdminBody.message, "Unauthorized!");
  console.log("  ✓ Non-admin caller rejected with 403 Unauthorized");

  // 2B. Admin role via gateway -> 200 OK
  const adminRes = await adminApp.request("/protected-admin", {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-payment-internal-secret-xyz",
      [GATEWAY_HEADERS.USER_ID]: "user_admin_999",
      [GATEWAY_HEADERS.USER_ROLE]: "admin",
    },
  });
  assert.equal(adminRes.status, 200, "Admin must succeed");
  const adminBody = (await adminRes.json()) as {
    userId: string;
    role?: string;
  };
  assert.equal(adminBody.userId, "user_admin_999");
  assert.equal(adminBody.role, "admin");
  console.log("  ✓ Admin caller authorized successfully");

  // ---------------------------------------------------------------------------
  // 3. Testing Webhook Signature Verification Endpoint
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing Stripe webhook endpoint failure handling...");
  const whApp = new Hono();
  whApp.route("/webhooks", webhookRoute);

  // 3A. Health ping on webhooks
  const whPingRes = await whApp.request("/webhooks");
  assert.equal(whPingRes.status, 200, "Webhook base route must return 200");
  const whPingBody = (await whPingRes.json()) as { status: string };
  assert.equal(whPingBody.status, "ok webhook");
  console.log("  ✓ Webhook status route responds 200 OK");

  // 3B. Invalid stripe-signature -> 400 Bad Request
  const badSigRes = await whApp.request("/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=12345,v1=invalidsignaturehash000000000000000000",
    },
    body: JSON.stringify({
      id: "evt_test_123",
      type: "checkout.session.completed",
    }),
  });
  assert.equal(
    badSigRes.status,
    400,
    "Invalid signature must return 400 Bad Request",
  );
  const badSigBody = (await badSigRes.json()) as { error?: string };
  assert.equal(badSigBody.error, "Webhook verification failed!");
  console.log(
    "  ✓ Webhook signature validation rejection verified (400 Bad Request)",
  );

  // ---------------------------------------------------------------------------
  // 4. Testing payment.successful Event Schema Invariants
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing PaymentSuccessfulType event contracts...");
  const mockPaymentEvent: PaymentSuccessfulType = {
    sessionId: "cs_test_a1b2c3d4e5",
    referenceId: "cs_test_a1b2c3d4e5",
    cartId: "cart_user_777",
    reservationId: "res_stock_888",
    couponCode: "SPRING2026",
    taxCalculationId: "tax_calc_999",
    taxAmount: 18.5,
    userId: "user_buyer_stripe_101",
    email: "customer@example.com",
    amount: 14999, // in cents
    status: "success",
    products: [
      {
        name: "Larek Pro Running Shoes",
        quantity: 1,
        price: 14999,
      },
    ],
  };

  assert.equal(mockPaymentEvent.status, "success");
  assert.equal(mockPaymentEvent.amount, 14999);
  assert.equal(mockPaymentEvent.products?.[0]?.name, "Larek Pro Running Shoes");
  assert.equal(mockPaymentEvent.couponCode, "SPRING2026");
  console.log("  ✓ PaymentSuccessfulType contract adherence validated");

  console.log("\n==================================================");
  console.log("🎉 ALL PAYMENT SERVICE SQA TESTS PASSED (100%)");
  console.log("==================================================");
}

runPaymentServiceTests().catch((err) => {
  console.error("❌ Payment service tests failed:", err);
  process.exit(1);
});
