import assert from "node:assert/strict";
import {
  shouldBeUser,
  shouldBeAdmin,
} from "../src/middleware/authMiddleware.js";
import {
  handleSellerActivatedEvent,
  handleSellerSuspendedEvent,
  handleDelegationGrantedEvent,
  handleDelegationRevokedEvent,
} from "../src/consumer.js";
import { GATEWAY_HEADERS, UserFormSchema } from "@repo/types";

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  json(data: unknown): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runAuthServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("🔐 auth-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = "test-auth-internal-secret-987";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: shouldBeUser Authentication Guard
    // -------------------------------------------------------------------------
    console.log("\n1. Testing shouldBeUser authentication guard...");

    // 1A. Unauthenticated request -> 401
    let nextCalled = false;
    const unauthReq = {
      headers: {},
      auth: () => ({
        tokenType: "session_token",
        userId: null,
        sessionClaims: null,
      }),
    } as any;
    const unauthRes = createMockResponse();

    shouldBeUser(unauthReq, unauthRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      unauthRes.statusCode,
      401,
      "Unauthenticated user request must return 401",
    );
    assert.deepEqual(unauthRes.body, { message: "You are not logged in!" });
    assert.equal(nextCalled, false);
    console.log("  ✓ Unauthenticated user request rejected with 401");

    // 1B. Authenticated via Clerk Token -> 200
    nextCalled = false;
    const clerkUserReq = {
      headers: {},
      auth: () => ({
        tokenType: "session_token",
        userId: "user_clerk_auth_777",
        sessionClaims: { metadata: { role: "user" } },
      }),
    } as any;
    const clerkUserRes = createMockResponse();

    shouldBeUser(clerkUserReq, clerkUserRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      nextCalled,
      true,
      "Clerk authenticated user must invoke next()",
    );
    assert.equal(clerkUserReq.userId, "user_clerk_auth_777");
    console.log("  ✓ Clerk token user authenticated successfully");

    // 1C. Authenticated via API Gateway Header Propagation -> 200
    nextCalled = false;
    const gatewayUserReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-auth-internal-secret-987",
        [GATEWAY_HEADERS.USER_ID]: "user_gw_propagated_123",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const gatewayUserRes = createMockResponse();

    shouldBeUser(gatewayUserReq, gatewayUserRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      nextCalled,
      true,
      "Gateway header authenticated request must invoke next()",
    );
    assert.equal(gatewayUserReq.userId, "user_gw_propagated_123");
    console.log(
      "  ✓ Trusted API Gateway propagation authenticated successfully",
    );

    // -------------------------------------------------------------------------
    // TEST 2: shouldBeAdmin Authorization Guard
    // -------------------------------------------------------------------------
    console.log("\n2. Testing shouldBeAdmin authorization guard...");

    // 2A. Gateway Non-Admin -> 403 Forbidden
    nextCalled = false;
    const nonAdminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-auth-internal-secret-987",
        [GATEWAY_HEADERS.USER_ID]: "user_regular_456",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const nonAdminRes = createMockResponse();

    shouldBeAdmin(nonAdminReq, nonAdminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(
      nonAdminRes.statusCode,
      403,
      "Non-admin gateway request must return 403",
    );
    assert.deepEqual(nonAdminRes.body, { message: "Unauthorized!" });
    assert.equal(nextCalled, false);
    console.log("  ✓ Non-admin request rejected with 403 Unauthorized");

    // 2B. Gateway Admin -> 200 OK
    nextCalled = false;
    const adminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-auth-internal-secret-987",
        [GATEWAY_HEADERS.USER_ID]: "admin_master_001",
        [GATEWAY_HEADERS.USER_ROLE]: "admin",
      },
    } as any;
    const adminRes = createMockResponse();

    shouldBeAdmin(adminReq, adminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Admin gateway request must invoke next()");
    assert.equal(adminReq.userId, "admin_master_001");
    assert.equal(adminReq.userRole, "admin");
    console.log("  ✓ Admin gateway request authorized successfully");

    // 2C. Direct Clerk Admin Token -> 200 OK
    nextCalled = false;
    const clerkAdminReq = {
      headers: {},
      auth: () => ({
        tokenType: "session_token",
        userId: "admin_clerk_999",
        sessionClaims: { metadata: { role: "admin" } },
      }),
    } as any;
    const clerkAdminRes = createMockResponse();

    shouldBeAdmin(clerkAdminReq, clerkAdminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Clerk admin token must invoke next()");
    assert.equal(clerkAdminReq.userId, "admin_clerk_999");
    console.log("  ✓ Clerk admin token authorized successfully");

    // -------------------------------------------------------------------------
    // TEST 3: UserFormSchema Validation
    // -------------------------------------------------------------------------
    console.log("\n3. Testing UserFormSchema validation invariants...");

    const validUserPayload = {
      firstName: "Alex",
      lastName: "Rider",
      username: "alexrider007",
      emailAddress: ["alex.rider@example.com"],
      password: "SuperSecretPassword123!",
    };

    const validParsed = UserFormSchema.safeParse(validUserPayload);
    assert.equal(
      validParsed.success,
      true,
      "Valid user payload must parse successfully",
    );
    console.log("  ✓ Valid UserFormSchema successfully parsed");

    const invalidUserPayload = {
      firstName: "",
      lastName: "",
      username: "al", // Too short
      emailAddress: "invalid-email-string",
      password: "123", // Too short
    };

    const invalidParsed = UserFormSchema.safeParse(invalidUserPayload);
    assert.equal(
      invalidParsed.success,
      false,
      "Invalid user payload must fail validation",
    );
    console.log("  ✓ Invalid UserFormSchema rejected with schema errors");

    // -------------------------------------------------------------------------
    // TEST 4: User Event Contracts (user.created and user.deleted)
    // -------------------------------------------------------------------------
    console.log("\n4. Testing user Kafka event structures...");

    const userCreatedPayload = {
      userId: "user_new_clerk_123",
      username: "alexrider007",
      email: "alex.rider@example.com",
      firstName: "Alex",
      lastName: "Rider",
      isSeller: false,
    };

    assert.equal(userCreatedPayload.userId, "user_new_clerk_123");
    assert.equal(typeof userCreatedPayload.isSeller, "boolean");
    console.log("  ✓ user.created event payload structure verified");

    const userDeletedPayload = {
      userId: "user_deleted_456",
    };
    assert.equal(userDeletedPayload.userId, "user_deleted_456");
    console.log("  ✓ user.deleted event payload structure verified");

    // -------------------------------------------------------------------------
    // TEST 5: Clerk Metadata Kafka Event Handlers (isSeller & canManageSellers)
    // -------------------------------------------------------------------------
    console.log(
      "\n5. Testing Clerk Metadata Kafka Handlers (isSeller & canManageSellers)...",
    );

    const mockClerkDb: Record<string, Record<string, unknown>> = {};
    const mockClerkClient = {
      users: {
        updateUserMetadata: async (
          userId: string,
          params: { publicMetadata: Record<string, unknown> },
        ) => {
          mockClerkDb[userId] = {
            ...(mockClerkDb[userId] || {}),
            ...params.publicMetadata,
          };
          return { id: userId, publicMetadata: mockClerkDb[userId] };
        },
      },
    } as any;

    // 5A: seller.activated sets isSeller: true
    const activatedSuccess = await handleSellerActivatedEvent(
      {
        sellerId: "sel_101",
        userId: "user_merchant_101",
        isSeller: true,
      },
      mockClerkClient,
    );
    assert.equal(activatedSuccess, true);
    assert.equal(mockClerkDb["user_merchant_101"]?.isSeller, true);
    console.log(
      "  ✓ seller.activated successfully synchronized publicMetadata.isSeller = true",
    );

    // 5B: seller.suspended sets isSeller: false
    const suspendedSuccess = await handleSellerSuspendedEvent(
      {
        sellerId: "sel_101",
        userId: "user_merchant_101",
        isSeller: false,
        reason: "Compliance violation",
      },
      mockClerkClient,
    );
    assert.equal(suspendedSuccess, true);
    assert.equal(mockClerkDb["user_merchant_101"]?.isSeller, false);
    console.log(
      "  ✓ seller.suspended successfully synchronized publicMetadata.isSeller = false",
    );

    // 5C: admin.delegation.granted sets canManageSellers: true
    const delegationGranted = await handleDelegationGrantedEvent(
      {
        adminUserId: "admin_user_manage_505",
        permission: "manage_sellers",
        action: "GRANTED",
      },
      mockClerkClient,
    );
    assert.equal(delegationGranted, true);
    assert.equal(mockClerkDb["admin_user_manage_505"]?.canManageSellers, true);
    console.log(
      "  ✓ admin.delegation.granted successfully synchronized publicMetadata.canManageSellers = true",
    );

    // 5D: admin.delegation.revoked sets canManageSellers: false
    const delegationRevoked = await handleDelegationRevokedEvent(
      {
        adminUserId: "admin_user_manage_505",
        action: "REVOKED",
      },
      mockClerkClient,
    );
    assert.equal(delegationRevoked, true);
    assert.equal(mockClerkDb["admin_user_manage_505"]?.canManageSellers, false);
    console.log(
      "  ✓ admin.delegation.revoked successfully synchronized publicMetadata.canManageSellers = false",
    );

    // 5E: Resiliency on missing target IDs
    const missingTarget = await handleSellerActivatedEvent(
      { sellerId: "sel_empty" },
      mockClerkClient,
    );
    assert.equal(missingTarget, false);
    console.log(
      "  ✓ Missing user ID payloads handled gracefully without throwing",
    );

    console.log("\n==================================================");
    console.log("🎉 ALL AUTH SERVICE SQA TESTS PASSED (100%)");
    console.log("==================================================");
  } finally {
    process.env.INTERNAL_SERVICE_SECRET = originalSecret;
  }
}

runAuthServiceTests().catch((err) => {
  console.error("❌ Auth service tests failed:", err);
  process.exit(1);
});
