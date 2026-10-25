import assert from "node:assert/strict";
import {
  shouldBeUser,
  shouldBeAdmin,
} from "../src/middleware/authMiddleware.js";
import {
  getMetricsSnapshot,
  getMerchantMetricsSnapshot,
  recordVendorEvent,
} from "../src/services/metrics.service.js";
import {
  GATEWAY_HEADERS,
  type AnalyticsSummaryType,
  type MerchantAnalyticsMetricsType,
} from "@repo/types";

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

async function runAnalyticServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("📊 analytic-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = "test-analytics-secret-456";

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
      "Unauthenticated request must return 401",
    );
    assert.deepEqual(unauthRes.body, { message: "You are not logged in!" });
    assert.equal(nextCalled, false);
    console.log("  ✓ Unauthenticated user request rejected with 401");

    // 1B. Clerk authenticated token -> 200
    nextCalled = false;
    const clerkUserReq = {
      headers: {},
      auth: () => ({
        tokenType: "session_token",
        userId: "user_analytic_observer_101",
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
    assert.equal(clerkUserReq.userId, "user_analytic_observer_101");
    console.log("  ✓ Clerk token user authenticated successfully");

    // 1C. Gateway trusted header propagation -> 200
    nextCalled = false;
    const gatewayReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-analytics-secret-456",
        [GATEWAY_HEADERS.USER_ID]: "user_gw_analyst_202",
        [GATEWAY_HEADERS.USER_ROLE]: "user",
      },
    } as any;
    const gatewayRes = createMockResponse();

    shouldBeUser(gatewayReq, gatewayRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Trusted gateway header must invoke next()");
    assert.equal(gatewayReq.userId, "user_gw_analyst_202");
    console.log("  ✓ Gateway header propagation authenticated successfully");

    // -------------------------------------------------------------------------
    // TEST 2: shouldBeAdmin Authorization Guard
    // -------------------------------------------------------------------------
    console.log("\n2. Testing shouldBeAdmin authorization guard...");

    // 2A. Gateway Non-Admin -> 403 Forbidden
    nextCalled = false;
    const nonAdminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-analytics-secret-456",
        [GATEWAY_HEADERS.USER_ID]: "user_regular_303",
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
      "Non-admin request must receive 403",
    );
    assert.deepEqual(nonAdminRes.body, {
      message: "Unauthorized: Admin access required!",
    });
    assert.equal(nextCalled, false);
    console.log("  ✓ Non-admin request rejected with 403 Unauthorized");

    // 2B. Gateway Admin -> 200 OK
    nextCalled = false;
    const adminReq = {
      headers: {
        [GATEWAY_HEADERS.INTERNAL_SECRET]: "test-analytics-secret-456",
        [GATEWAY_HEADERS.USER_ID]: "admin_analyst_404",
        [GATEWAY_HEADERS.USER_ROLE]: "admin",
      },
    } as any;
    const adminRes = createMockResponse();

    shouldBeAdmin(adminReq, adminRes as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Admin request must invoke next()");
    assert.equal(adminReq.userId, "admin_analyst_404");
    console.log("  ✓ Admin request authorized successfully");

    // -------------------------------------------------------------------------
    // TEST 3: In-Memory KPI Aggregation & Metrics Snapshot
    // -------------------------------------------------------------------------
    console.log("\n3. Testing KPI aggregation and metrics snapshots...");

    const initialSnapshot: AnalyticsSummaryType = getMetricsSnapshot();
    assert.equal(typeof initialSnapshot.totalRevenue, "number");
    assert.equal(typeof initialSnapshot.totalOrders, "number");
    assert.equal(typeof initialSnapshot.totalVendorsRegistered, "number");
    console.log("  ✓ getMetricsSnapshot() returned structured metrics summary");

    const initialMerchantSnapshot: MerchantAnalyticsMetricsType =
      getMerchantMetricsSnapshot();
    const prevVendors = initialMerchantSnapshot.totalVendorsRegistered;

    // Simulate vendor registration event
    await recordVendorEvent("vendor.registered", { vendorId: "v_test_999" });
    const updatedMerchantSnapshot = getMerchantMetricsSnapshot();
    assert.equal(
      updatedMerchantSnapshot.totalVendorsRegistered,
      prevVendors + 1,
      "totalVendorsRegistered must increment by 1",
    );
    console.log(
      "  ✓ recordVendorEvent accurately increments in-memory KPI counters",
    );

    // -------------------------------------------------------------------------
    // TEST 4: EventBatcher Ring Buffer & Micro-Batch Queue
    // -------------------------------------------------------------------------
    console.log("\n4. Testing EventBatcher ring buffer & queue buffering...");
    const { eventBatcher } = await import("../src/services/event-batcher.js");
    const initialQueueLen = eventBatcher.getQueueLength();

    eventBatcher.enqueue({
      eventType: "test.high_velocity_event",
      userId: "user_batch_test",
      amount: 49.99,
      metadata: { source: "sqa_unit_test" },
      createdAt: new Date(),
    });

    assert.equal(
      eventBatcher.getQueueLength(),
      initialQueueLen + 1,
      "eventBatcher queue length must increment after enqueueing",
    );
    console.log(
      "  ✓ eventBatcher correctly enqueues event to in-memory ring buffer",
    );

    console.log("\n==================================================");
    console.log("🎉 ALL ANALYTIC SERVICE SQA TESTS PASSED (100%)");
    console.log("==================================================");
  } finally {
    process.env.INTERNAL_SERVICE_SECRET = originalSecret;
  }
}

runAnalyticServiceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Analytic service tests failed:", err);
    process.exit(1);
  });
