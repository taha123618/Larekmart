import assert from "node:assert/strict";
import { requireAuth, requireAdmin, requireSeller } from "../../src/auth/authorization.js";
import type { FastifyReply, FastifyRequest } from "fastify";

function createMockContext(user?: { authUserId?: string; userRole?: string }) {
  let sentStatus: number | undefined;
  let sentPayload: any;

  const req = {
    authUserId: user?.authUserId,
    userRole: user?.userRole,
    url: "/test-endpoint",
    method: "GET",
    headers: { "x-request-id": "req-test-123" },
  } as unknown as FastifyRequest;

  const reply = {
    status(code: number) {
      sentStatus = code;
      return this;
    },
    send(payload: any) {
      sentPayload = payload;
      return this;
    },
  } as unknown as FastifyReply;

  return {
    req,
    reply,
    getStatus: () => sentStatus,
    getPayload: () => sentPayload,
  };
}

export async function runAuthTests() {
  console.log("▶ [AUTH] Running Authorization Guard tests...");

  // Test 1: requireAuth rejects unauthenticated request
  const unauthCtx = createMockContext();
  await requireAuth(unauthCtx.req, unauthCtx.reply);
  assert.equal(unauthCtx.getStatus(), 401);
  assert.equal(unauthCtx.getPayload().error, "Unauthorized");

  // Test 2: requireAuth allows authenticated user
  const authCtx = createMockContext({ authUserId: "user_123", userRole: "customer" });
  await requireAuth(authCtx.req, authCtx.reply);
  assert.equal(authCtx.getStatus(), undefined, "Authenticated user should not be rejected");

  // Test 3: requireAdmin rejects customer user with 403 Forbidden
  const customerCtx = createMockContext({ authUserId: "user_123", userRole: "customer" });
  await requireAdmin(customerCtx.req, customerCtx.reply);
  assert.equal(customerCtx.getStatus(), 403);
  assert.equal(customerCtx.getPayload().error, "Forbidden");

  // Test 4: requireAdmin allows admin user
  const adminCtx = createMockContext({ authUserId: "admin_123", userRole: "admin" });
  await requireAdmin(adminCtx.req, adminCtx.reply);
  assert.equal(adminCtx.getStatus(), undefined, "Admin should not be rejected");

  // Test 5: requireSeller allows seller and admin, rejects customer
  const sellerCtx = createMockContext({ authUserId: "seller_123", userRole: "seller" });
  await requireSeller(sellerCtx.req, sellerCtx.reply);
  assert.equal(sellerCtx.getStatus(), undefined, "Seller should not be rejected");

  const sellerAdminCtx = createMockContext({ authUserId: "admin_123", userRole: "admin" });
  await requireSeller(sellerAdminCtx.req, sellerAdminCtx.reply);
  assert.equal(sellerAdminCtx.getStatus(), undefined, "Admin should be allowed on seller route");

  const nonSellerCtx = createMockContext({ authUserId: "user_123", userRole: "customer" });
  await requireSeller(nonSellerCtx.req, nonSellerCtx.reply);
  assert.equal(nonSellerCtx.getStatus(), 403);

  console.log("✔ [AUTH] Authorization Guard tests passed");
}
