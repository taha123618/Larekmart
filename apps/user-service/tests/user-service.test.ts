import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";
import {
  CreateAddressSchema,
  UpdateProfileSchema,
  UpdatePreferencesSchema,
  UpdateSettingsSchema,
  UserEventPayloadSchema,
  AdminUpdateUserStatusSchema,
  UserDetailResponseSchema,
} from "@repo/types";
import { UserCacheKeys } from "../src/cache/user-cache.js";

async function runTests() {
  console.log("=== Running User Service Tests ===");

  // 1. Test Fastify App Build & Health Routes
  console.log("\n[Test 1] Fastify Server & Health Endpoints");
  const app = await buildServer();

  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.equal(healthRes.statusCode, 200, "Expected /health to return 200");
  const healthJson = JSON.parse(healthRes.payload);
  assert.equal(healthJson.status, "ok");
  assert.equal(healthJson.service, "user-service");
  console.log("✓ /health passed");

  const metricsRes = await app.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200, "Expected /metrics to return 200");
  assert.ok(
    metricsRes.payload.includes("user_requests_total"),
    "Expected metrics to include user_requests_total",
  );
  console.log("✓ /metrics passed");

  // 2. Test Route Protection (Authentication Gating)
  console.log("\n[Test 2] Auth Gating Verification (Clerk Middleware)");
  const endpoints = [
    { method: "GET" as const, url: "/api/v1/users/me" },
    { method: "PATCH" as const, url: "/api/v1/users/me" },
    { method: "DELETE" as const, url: "/api/v1/users/me" },
    { method: "GET" as const, url: "/api/v1/users/me/profile" },
    { method: "PATCH" as const, url: "/api/v1/users/me/profile" },
    { method: "GET" as const, url: "/api/v1/users/me/addresses" },
    { method: "POST" as const, url: "/api/v1/users/me/addresses" },
    { method: "GET" as const, url: "/api/v1/users/me/addresses/addr_123" },
    { method: "PATCH" as const, url: "/api/v1/users/me/addresses/addr_123" },
    { method: "DELETE" as const, url: "/api/v1/users/me/addresses/addr_123" },
    { method: "GET" as const, url: "/api/v1/users/me/preferences" },
    { method: "PATCH" as const, url: "/api/v1/users/me/preferences" },
    { method: "GET" as const, url: "/api/v1/users/me/settings" },
    { method: "PATCH" as const, url: "/api/v1/users/me/settings" },
    { method: "GET" as const, url: "/api/v1/users/admin/users" },
  ];

  for (const ep of endpoints) {
    const res = await app.inject({
      method: ep.method,
      url: ep.url,
    });
    assert.equal(
      res.statusCode,
      401,
      `Expected ${ep.method} ${ep.url} without auth to return 401`,
    );
  }
  console.log(
    "✓ All 15 protected user & admin routes strictly reject unauthenticated requests with 401",
  );

  // 3. Address Schema Validation
  console.log("\n[Test 3] Address Schema Validation");
  const validAddress = {
    type: "SHIPPING",
    recipientName: "Jane Doe",
    phone: "+15551234567",
    addressLine1: "123 Fashion Blvd",
    addressLine2: "Suite 400",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US",
    isDefault: true,
  };
  const parsedAddress = CreateAddressSchema.safeParse(validAddress);
  assert.ok(parsedAddress.success, "Valid address should pass validation");

  const invalidAddress = {
    recipientName: "", // missing required
    phone: "",
    addressLine1: "",
  };
  const failedAddress = CreateAddressSchema.safeParse(invalidAddress);
  assert.ok(!failedAddress.success, "Invalid address should fail validation");
  console.log(
    "✓ Address schemas strictly enforce required shipping/billing fields",
  );

  // 4. Profile Schema Validation
  console.log("\n[Test 4] Profile Schema Validation");
  const validProfile = {
    firstName: "Alice",
    lastName: "Smith",
    displayName: "Alice S.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    bio: "Fashion enthusiast",
  };
  assert.ok(
    UpdateProfileSchema.safeParse(validProfile).success,
    "Valid profile should parse",
  );

  const invalidAvatar = {
    avatarUrl: "not-a-valid-url",
  };
  assert.ok(
    !UpdateProfileSchema.safeParse(invalidAvatar).success,
    "Invalid avatar URL should fail",
  );
  console.log("✓ Profile schemas validate URL formats and string boundaries");

  // 5. Preferences & Settings Validation
  console.log("\n[Test 5] Preferences & Settings Validation");
  const validPreferences = {
    preferredLanguage: "fr",
    currency: "EUR",
    timezone: "Europe/Paris",
    marketingEmail: false,
    pushNotifications: true,
  };
  assert.ok(UpdatePreferencesSchema.safeParse(validPreferences).success);

  const validSettings = {
    profileVisibility: "contacts" as const,
    twoFactorPrompt: true,
    orderUpdatesEmail: true,
  };
  assert.ok(UpdateSettingsSchema.safeParse(validSettings).success);

  const invalidSettings = {
    profileVisibility: "everyone", // not allowed
  };
  assert.ok(!UpdateSettingsSchema.safeParse(invalidSettings).success);
  console.log("✓ Preferences & Settings validate enums and configurations");

  // 6. Redis Cache Keys
  console.log("\n[Test 6] Redis Cache Key Consistency");
  assert.equal(UserCacheKeys.userMe("usr_123"), "user:me:usr_123");
  assert.equal(UserCacheKeys.userProfile("usr_123"), "user:profile:usr_123");
  assert.equal(UserCacheKeys.userByAuth("auth_456"), "user:auth:auth_456");
  assert.equal(UserCacheKeys.addresses("usr_123"), "user:addresses:usr_123");
  assert.equal(
    UserCacheKeys.preferences("usr_123"),
    "user:preferences:usr_123",
  );
  assert.equal(UserCacheKeys.settings("usr_123"), "user:settings:usr_123");
  console.log("✓ Redis cache keys conform to namespace standards");

  // 7. Kafka User Domain Events Validation
  console.log("\n[Test 7] Kafka Domain Event Payloads");
  const testPayload = {
    eventId: "evt_999",
    eventType: "user.profile_updated",
    userId: "usr_123",
    timestamp: new Date().toISOString(),
    data: {
      fields: ["firstName", "avatarUrl"],
    },
  };
  assert.ok(UserEventPayloadSchema.safeParse(testPayload).success);
  console.log("✓ Kafka domain event payloads conform to shared event contract");

  // 8. User isSeller Privilege & Database Synchronization
  console.log("\n[Test 8] User isSeller Privilege & Database Synchronization");

  // A. Admin update user status schema with isSeller
  const validStatusUpdate = {
    status: "ACTIVE" as const,
    isSeller: true,
  };
  const parsedStatus = AdminUpdateUserStatusSchema.safeParse(validStatusUpdate);
  assert.ok(parsedStatus.success);
  assert.equal(parsedStatus.data?.isSeller, true);

  const toggleSellerFalse = AdminUpdateUserStatusSchema.safeParse({
    isSeller: false,
  });
  assert.ok(toggleSellerFalse.success);
  assert.equal(toggleSellerFalse.data?.isSeller, false);

  // Non-boolean isSeller rejected
  assert.ok(
    !AdminUpdateUserStatusSchema.safeParse({ isSeller: "true" as any }).success,
  );

  // B. UserDetailResponseSchema isSeller defaults to false and supports true
  const defaultUserDetail = UserDetailResponseSchema.safeParse({
    id: "usr_abc",
    authUserId: "auth_abc",
    email: "customer@larekmart.com",
    phone: null,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.ok(defaultUserDetail.success);
  assert.equal(defaultUserDetail.data?.isSeller, false);

  const verifiedSellerDetail = UserDetailResponseSchema.safeParse({
    id: "usr_abc",
    authUserId: "auth_abc",
    email: "seller@larekmart.com",
    phone: null,
    status: "ACTIVE",
    isSeller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.ok(verifiedSellerDetail.success);
  assert.equal(verifiedSellerDetail.data?.isSeller, true);

  // C. Test consumer safety for seller privilege events
  const { handleSellerPrivilegeGranted } = await import(
    "../src/consumers/auth.consumer.js"
  );
  // Graceful no-op when user not found or empty payload
  await handleSellerPrivilegeGranted(null);
  await handleSellerPrivilegeGranted({});
  await handleSellerPrivilegeGranted({ primaryUserId: "non_existent_auth_id" });

  console.log("✓ isSeller schemas, defaults, and consumer handlers verified");

  // 9. Zero-Trust Internal & Admin Middleware Gating
  console.log("\n[Test 9] Zero-Trust Internal & Admin Middleware Gating");
  const { shouldBeInternalOrAdmin } = await import(
    "../src/middleware/auth.middleware.js"
  );

  // Case A: Proxied non-admin user with internal secret -> Must be rejected (403)
  let statusSet = 0;
  let bodySent: any = null;
  const mockReplyNonAdmin = {
    status(code: number) {
      statusSet = code;
      return {
        send(b: any) {
          bodySent = b;
        },
      };
    },
  };
  const mockReqNonAdmin = {
    headers: {
      "x-internal-secret": "dev-shared-internal-secret-larekmart",
      "x-user-id": "cust_123",
      "x-user-role": "user",
    },
  } as any;
  await shouldBeInternalOrAdmin(mockReqNonAdmin, mockReplyNonAdmin as any);
  assert.equal(
    statusSet,
    403,
    "Non-admin user proxied with internal secret must return 403",
  );
  console.log(
    "  ✓ Zero-Trust verified: Non-admin user proxied with internal secret rejected with 403",
  );

  // Case B: Proxied admin user with internal secret -> Passes (sets user role to admin)
  statusSet = 0;
  const mockReplyAdmin = {
    status(code: number) {
      statusSet = code;
      return { send() {} };
    },
  };
  const mockReqAdmin = {
    headers: {
      "x-internal-secret": "dev-shared-internal-secret-larekmart",
      "x-user-id": "admin_123",
      "x-user-role": "admin",
    },
  } as any;
  await shouldBeInternalOrAdmin(mockReqAdmin, mockReplyAdmin as any);
  assert.equal(statusSet, 0, "Admin user must pass without error");
  assert.equal(mockReqAdmin.userRole, "admin");
  console.log("  ✓ Proxied admin authorized successfully");

  // Case C: Pure internal machine-to-machine call -> Passes without user headers
  statusSet = 0;
  const mockReqM2M = {
    headers: {
      "x-internal-secret": "dev-shared-internal-secret-larekmart",
    },
  } as any;
  await shouldBeInternalOrAdmin(mockReqM2M, mockReplyAdmin as any);
  assert.equal(statusSet, 0, "Pure M2M call must pass without error");
  console.log(
    "  ✓ Pure machine-to-machine internal call authorized successfully",
  );

  await app.close();
  console.log("\n=== ALL USER SERVICE TESTS PASSED SUCCESSFULLY! ===\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
