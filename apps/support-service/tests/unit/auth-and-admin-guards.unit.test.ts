import "reflect-metadata";
import assert from "node:assert/strict";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "../../src/common/guards/auth.guard.js";
import {
  AdminGuard,
  safeTimingCompare,
  isInternalService,
} from "../../src/common/guards/admin.guard.js";
import { env } from "../../src/config/env.js";

function createMockContext(headers: Record<string, string | undefined>): any {
  const request: any = {
    headers: { ...headers },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  };
}

async function runAuthAndAdminGuardsUnitTests() {
  console.log("==================================================");
  console.log("    SUPPORT SERVICE - AUTH & ADMIN GUARDS TESTS   ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  console.log("[1. Constant-Time Timing Safe Compare (safeTimingCompare)]");

  test("Identical strings return true", () => {
    assert.equal(
      safeTimingCompare("secret-key-12345", "secret-key-12345"),
      true,
    );
  });

  test("Different strings of the same length return false", () => {
    assert.equal(
      safeTimingCompare("secret-key-12345", "secret-key-99999"),
      false,
    );
  });

  test("Different strings of differing length return false", () => {
    assert.equal(
      safeTimingCompare("secret-key-123", "secret-key-1234567"),
      false,
    );
  });

  test("Empty or missing inputs return false safely without exception", () => {
    assert.equal(safeTimingCompare("", "secret-key"), false);
    assert.equal(safeTimingCompare("secret-key", ""), false);
    assert.equal(safeTimingCompare(undefined, "secret-key"), false);
    assert.equal(safeTimingCompare("secret-key", undefined), false);
    assert.equal(safeTimingCompare(undefined, undefined), false);
  });

  test("Single character difference at the start returns false", () => {
    assert.equal(
      safeTimingCompare("Aecret-key-12345", "Becret-key-12345"),
      false,
    );
  });

  test("Single character difference at the end returns false", () => {
    assert.equal(
      safeTimingCompare("secret-key-1234A", "secret-key-1234B"),
      false,
    );
  });

  console.log("\n[2. Authentication Guard (AuthGuard)]");

  const authGuard = new AuthGuard();

  test("Missing x-user-id header throws UnauthorizedException", () => {
    const ctx = createMockContext({});
    assert.throws(
      () => authGuard.canActivate(ctx),
      (err: any) =>
        err instanceof UnauthorizedException &&
        err.message.includes("x-user-id"),
    );
  });

  test("Valid x-user-id extracts user identity and attaches to request", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_customer_123",
      "x-user-role": "user",
      "x-user-email": "customer@example.com",
      "x-user-is-seller": "false",
    });

    const result = authGuard.canActivate(ctx);
    assert.equal(result, true);
    assert.deepEqual(ctx.request.user, {
      userId: "usr_customer_123",
      role: "user",
      email: "customer@example.com",
      isSeller: false,
    });
  });

  test("x-user-is-seller: 'true' sets isSeller: true", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_seller_456",
      "x-user-role": "seller",
      "x-user-is-seller": "true",
    });

    const result = authGuard.canActivate(ctx);
    assert.equal(result, true);
    assert.equal(ctx.request.user.isSeller, true);
  });

  test("Default role fallback is 'user' when x-user-role is omitted", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_default_789",
    });

    const result = authGuard.canActivate(ctx);
    assert.equal(result, true);
    assert.equal(ctx.request.user.role, "user");
  });

  console.log("\n[3. Administrator Guard (AdminGuard)]");

  const adminGuard = new AdminGuard();

  test("Caller with role 'admin' passes AdminGuard", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_admin_001",
      "x-user-role": "admin",
    });
    assert.equal(adminGuard.canActivate(ctx), true);
  });

  test("Caller with role 'super_admin' passes AdminGuard", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_super_001",
      "x-user-role": "super_admin",
    });
    assert.equal(adminGuard.canActivate(ctx), true);
  });

  test("Caller with x-user-is-super-admin: 'true' passes AdminGuard", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_super_002",
      "x-user-is-super-admin": "true",
    });
    assert.equal(adminGuard.canActivate(ctx), true);
  });

  test("Ordinary customer with role 'user' is rejected with ForbiddenException", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_customer_999",
      "x-user-role": "user",
    });
    assert.throws(
      () => adminGuard.canActivate(ctx),
      (err: any) =>
        err instanceof ForbiddenException &&
        err.message.includes("Administrative access required"),
    );
  });

  test("Seller with role 'seller' is rejected from admin endpoints", () => {
    const ctx = createMockContext({
      "x-user-id": "usr_seller_999",
      "x-user-role": "seller",
      "x-user-is-seller": "true",
    });
    assert.throws(
      () => adminGuard.canActivate(ctx),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  test("Machine-to-machine internal call with valid secret and no user identity passes", () => {
    const ctx = createMockContext({
      "x-internal-secret": env.GATEWAY_INTERNAL_SECRET,
    });
    assert.equal(adminGuard.canActivate(ctx), true);
  });

  test("Proxied user request with internal secret but role 'user' CANNOT escalate to admin", () => {
    const ctx = createMockContext({
      "x-internal-secret": env.GATEWAY_INTERNAL_SECRET,
      "x-user-id": "malicious_user_001",
      "x-user-role": "user",
    });
    assert.throws(
      () => adminGuard.canActivate(ctx),
      (err: any) =>
        err instanceof ForbiddenException &&
        err.message.includes("Administrative access required"),
    );
  });

  console.log("\n==================================================");
  console.log(
    `  AUTH & ADMIN GUARDS TESTS: ${passed} passed, ${failed} failed`,
  );
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthAndAdminGuardsUnitTests().catch((err) => {
  console.error("FATAL in auth guards unit tests:", err);
  process.exit(1);
});
