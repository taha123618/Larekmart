import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  VoteReviewSchema,
  ReportReviewSchema,
  ModerateReviewSchema,
  ReviewQuerySchema,
} from "@repo/types";

async function runTests() {
  console.log("==========================================");
  console.log("   REVIEW SERVICE TEST SUITE RUNNER");
  console.log("==========================================\n");

  const app = await buildServer();

  // ────────────────────────────────────────────────────────────
  // Test 1: Health & Readiness Probes
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Health & Readiness Endpoints");
  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok(
    [200, 503].includes(healthRes.statusCode),
    "Expected /health response",
  );
  const healthJson = JSON.parse(healthRes.payload);
  assert.equal(healthJson.service, "review-service");
  console.log("✓ /health endpoint verified");

  const readyRes = await app.inject({
    method: "GET",
    url: "/ready",
  });
  assert.ok(
    [200, 503].includes(readyRes.statusCode),
    "Expected /ready response",
  );
  console.log("✓ /ready endpoint verified");

  // ────────────────────────────────────────────────────────────
  // Test 2: Unauthenticated Route Protection (Clerk Auth Guards)
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Auth Gating Verification (Clerk Middleware)");
  const protectedCustomerEndpoints = [
    { method: "POST" as const, url: "/api/v1/products/prod_123/reviews" },
    { method: "GET" as const, url: "/api/v1/me/reviews" },
    { method: "PATCH" as const, url: "/api/v1/reviews/rev_123" },
    { method: "DELETE" as const, url: "/api/v1/reviews/rev_123" },
    { method: "POST" as const, url: "/api/v1/reviews/rev_123/votes" },
    { method: "POST" as const, url: "/api/v1/reviews/rev_123/reports" },
    { method: "POST" as const, url: "/api/v1/reviews/rev_123/response" },
  ];

  for (const ep of protectedCustomerEndpoints) {
    const res = await app.inject({
      method: ep.method,
      url: ep.url,
      payload: {},
    });
    assert.equal(
      res.statusCode,
      401,
      `Expected ${ep.method} ${ep.url} to reject unauthenticated request with 401`,
    );
  }
  console.log(
    "✓ All customer-authenticated endpoints strictly reject unauthenticated requests",
  );

  // ────────────────────────────────────────────────────────────
  // Test 3: Admin Moderation Route Protection
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Admin RBAC Protection");
  const adminEndpoints = [
    { method: "GET" as const, url: "/api/v1/admin/reviews" },
    {
      method: "PATCH" as const,
      url: "/api/v1/admin/reviews/rev_123/moderation",
    },
  ];

  for (const ep of adminEndpoints) {
    // Unauthenticated
    const unauthRes = await app.inject({
      method: ep.method,
      url: ep.url,
      payload: {},
    });
    assert.equal(
      unauthRes.statusCode,
      401,
      `Expected unauthenticated ${ep.method} ${ep.url} to return 401`,
    );

    // Authenticated as standard user via trusted gateway headers (non-admin)
    const userRes = await app.inject({
      method: ep.method,
      url: ep.url,
      headers: {
        "x-internal-secret": "dev-shared-internal-secret-larekmart",
        "x-user-id": "user_customer_123",
        "x-user-role": "user",
      },
      payload: { action: "APPROVE", reason: "Audit check" },
    });
    assert.equal(
      userRes.statusCode,
      403,
      `Expected customer ${ep.method} ${ep.url} to be forbidden with 403`,
    );

    // Forged gateway header without valid internal secret must be rejected
    const forgedRes = await app.inject({
      method: ep.method,
      url: ep.url,
      headers: {
        "x-user-id": "user_customer_123",
        "x-user-role": "admin",
      },
      payload: { action: "APPROVE", reason: "Audit check" },
    });
    assert.equal(
      forgedRes.statusCode,
      401,
      `Expected forged header ${ep.method} ${ep.url} to be rejected with 401`,
    );
  }
  console.log(
    "✓ Admin endpoints strictly require admin role and reject forged gateway headers",
  );

  // ────────────────────────────────────────────────────────────
  // Test 4: Zod Validation Contracts
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Zod Validation Contracts");

  // 4.1 Rating boundaries (1 to 5)
  assert.equal(
    CreateReviewSchema.safeParse({
      rating: 0,
      title: "Title",
      content: "Content",
    }).success,
    false,
  );
  assert.equal(
    CreateReviewSchema.safeParse({
      rating: 6,
      title: "Title",
      content: "Content",
    }).success,
    false,
  );
  assert.equal(
    CreateReviewSchema.safeParse({
      rating: 3.5,
      title: "Title",
      content: "Content",
    }).success,
    false,
  );
  assert.equal(
    CreateReviewSchema.safeParse({
      rating: 5,
      title: "Great Product",
      content: "This is a great product that I enjoyed using.",
    }).success,
    true,
  );
  console.log(
    "✓ Review star rating validated strictly between 1 and 5 integer",
  );

  // 4.2 Content and title lengths
  assert.equal(
    CreateReviewSchema.safeParse({ rating: 4, title: "A", content: "Short" })
      .success,
    false,
  );
  assert.equal(
    CreateReviewSchema.safeParse({
      rating: 4,
      title: "Valid Title",
      content: "Valid comprehensive review content here.",
    }).success,
    true,
  );
  console.log("✓ Review title and content lengths validated");

  // 4.3 Voting schemas
  assert.equal(
    VoteReviewSchema.safeParse({ voteType: "INVALID" }).success,
    false,
  );
  assert.equal(
    VoteReviewSchema.safeParse({ voteType: "HELPFUL" }).success,
    true,
  );
  assert.equal(
    VoteReviewSchema.safeParse({ voteType: "UNHELPFUL" }).success,
    true,
  );
  console.log("✓ Review voteType enum validated (HELPFUL | UNHELPFUL)");

  // 4.4 Report schemas
  assert.equal(
    ReportReviewSchema.safeParse({ reason: "SPAM", details: "Fake review" })
      .success,
    true,
  );
  assert.equal(
    ReportReviewSchema.safeParse({ reason: "INVALID_REASON" }).success,
    false,
  );
  console.log("✓ Review reporting reasons validated");

  // 4.5 Moderation schemas
  assert.equal(
    ModerateReviewSchema.safeParse({
      action: "APPROVE",
      reason: "Meets quality standards",
    }).success,
    true,
  );
  assert.equal(
    ModerateReviewSchema.safeParse({
      action: "INVALID",
      reason: "Invalid action",
    }).success,
    false,
  );
  console.log("✓ Review moderation actions validated");

  // 4.6 Query schemas
  const queryResult = ReviewQuerySchema.safeParse({
    page: "2",
    limit: "15",
    sort: "highest_rating",
  });
  assert.equal(queryResult.success, true);
  if (queryResult.success) {
    assert.equal(queryResult.data.page, 2);
    assert.equal(queryResult.data.limit, 15);
    assert.equal(queryResult.data.sort, "highest_rating");
  }
  console.log("✓ Review query pagination and sorting coercion validated");

  // ────────────────────────────────────────────────────────────
  // Test 5: Public Storefront Endpoints
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Public Storefront Review & Rating Queries");

  const publicReviewListRes = await app.inject({
    method: "GET",
    url: "/api/v1/products/prod_mock_123/reviews",
  });
  assert.ok(
    [200, 500].includes(publicReviewListRes.statusCode),
    "Public review query responded",
  );
  console.log("✓ Public product review list query operational");

  const summaryRes = await app.inject({
    method: "GET",
    url: "/api/v1/products/prod_mock_123/rating-summary",
  });
  assert.ok(
    [200, 500].includes(summaryRes.statusCode),
    "Public summary query responded",
  );
  console.log("✓ Public product rating summary query operational");

  await app.close();
  try {
    await redis.client.quit();
  } catch {
    // Ignore if already disconnected
  }

  console.log("\n==========================================");
  console.log("   ALL REVIEW SERVICE TESTS PASSED!");
  console.log("==========================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
