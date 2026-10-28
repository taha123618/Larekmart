import assert from "node:assert/strict";
import { shouldBeUser, shouldBeAdmin } from "../src/middleware/auth.js";
import {
  ProductEventPayloadSchema,
  BulkIndexRequestSchema,
  PartialUpdateProductSchema,
} from "../src/schemas/indexing.schema.js";
import { env } from "../src/config/env.js";
import { GATEWAY_HEADERS, ReindexRequestSchema } from "@repo/types";
import { runReindexDriftReconciliationTests } from "./unit/reindex-drift-reconciliation.test.js";

interface MockFastifyReply {
  statusCode: number;
  payload: unknown;
  status(code: number): MockFastifyReply;
  send(payload: unknown): MockFastifyReply;
}

function createMockReply(): MockFastifyReply {
  const reply: MockFastifyReply = {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
  return reply;
}

async function runSearchServiceTests(): Promise<void> {
  console.log("==================================================");
  console.log("🔍 search-service SQA Unit & Integration Test Suite");
  console.log("==================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: shouldBeUser Authentication Guard
  // ---------------------------------------------------------------------------
  console.log("\n1. Testing shouldBeUser authentication guard...");

  // 1A. Gateway trusted header propagation
  const gatewayUserReq = {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
      [GATEWAY_HEADERS.USER_ID]: "user_shopper_search_101",
      [GATEWAY_HEADERS.USER_ROLE]: "user",
    },
  } as any;
  const reply1 = createMockReply();

  await shouldBeUser(gatewayUserReq, reply1 as any);
  assert.equal(gatewayUserReq.userId, "user_shopper_search_101");
  assert.equal(gatewayUserReq.userRole, "user");
  console.log(
    "  ✓ Trusted API Gateway propagation sets request.userId and succeeds",
  );

  // ---------------------------------------------------------------------------
  // TEST 2: shouldBeAdmin Authorization Guard
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing shouldBeAdmin authorization guard...");

  // 2A. Gateway non-admin -> 403 Forbidden
  const nonAdminReq = {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
      [GATEWAY_HEADERS.USER_ID]: "user_regular_search_202",
      [GATEWAY_HEADERS.USER_ROLE]: "user",
    },
  } as any;
  const nonAdminReply = createMockReply();

  await shouldBeAdmin(nonAdminReq, nonAdminReply as any);
  assert.equal(nonAdminReply.statusCode, 403, "Non-admin must receive 403");
  const nonAdminErr = nonAdminReply.payload as {
    error?: { code: string; message: string };
  };
  assert.equal(nonAdminErr.error?.code, "FORBIDDEN");
  console.log("  ✓ Non-admin request rejected with 403 Forbidden");

  // 2B. Gateway admin -> Success
  const adminReq = {
    headers: {
      [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
      [GATEWAY_HEADERS.USER_ID]: "admin_search_ops_001",
      [GATEWAY_HEADERS.USER_ROLE]: "admin",
    },
  } as any;
  const adminReply = createMockReply();

  await shouldBeAdmin(adminReq, adminReply as any);
  assert.equal(adminReq.userId, "admin_search_ops_001");
  assert.equal(adminReq.userRole, "admin");
  console.log("  ✓ Admin request authorized successfully");

  // ---------------------------------------------------------------------------
  // TEST 3: Product Indexing Schemas Validation
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing ProductEventPayloadSchema invariants...");

  const rawProduct = {
    id: 12345, // number must transform to string
    name: "Wireless Noise-Cancelling Headphones",
    price: "199.99", // string must coerce to number
    categorySlug: "electronics",
    shortDescription: "Immersive audio with 40h battery life",
    description: "Premium headphones with adaptive active noise cancellation.",
    sizes: ["one-size"],
    colors: ["matte-black", "silver"],
    inStock: true,
  };

  const parsedProduct = ProductEventPayloadSchema.safeParse(rawProduct);
  assert.equal(
    parsedProduct.success,
    true,
    "ProductEventPayloadSchema must parse valid product",
  );
  if (parsedProduct.success) {
    assert.equal(
      typeof parsedProduct.data.id,
      "string",
      "ID must be transformed to string",
    );
    assert.equal(parsedProduct.data.id, "12345");
    assert.equal(
      typeof parsedProduct.data.price,
      "number",
      "Price must be coerced to number",
    );
    assert.equal(parsedProduct.data.price, 199.99);
  }
  console.log(
    "  ✓ ProductEventPayloadSchema correctly transforms and validates product fields",
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Bulk Index & Partial Update Schemas
  // ---------------------------------------------------------------------------
  console.log(
    "\n4. Testing BulkIndexRequestSchema and PartialUpdateProductSchema...",
  );

  const bulkRequest = {
    products: [
      { id: "101", name: "Pro Running Shoes", price: 120 },
      { id: "102", name: "Hydration Flask", price: 35 },
    ],
  };

  const parsedBulk = BulkIndexRequestSchema.safeParse(bulkRequest);
  assert.equal(
    parsedBulk.success,
    true,
    "Bulk index request must parse cleanly",
  );
  if (parsedBulk.success) {
    assert.equal(
      parsedBulk.data.batchSize,
      250,
      "Default batch size must be 250",
    );
    assert.equal(parsedBulk.data.products.length, 2);
  }
  console.log(
    "  ✓ BulkIndexRequestSchema defaulted batchSize and validated documents",
  );

  const partialUpdate = {
    stockQuantity: 45,
    discountPercentage: 15,
    inStock: true,
  };

  const parsedPartial = PartialUpdateProductSchema.safeParse(partialUpdate);
  assert.equal(
    parsedPartial.success,
    true,
    "Partial update payload must parse cleanly",
  );
  console.log(
    "  ✓ PartialUpdateProductSchema validated partial document updates",
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Reindex Request Schema
  // ---------------------------------------------------------------------------
  console.log("\n5. Testing ReindexRequestSchema contract...");

  const reindexPayload = {
    sourceIndex: "products-v1",
    targetIndex: "products-v2",
    batchSize: 500,
  };

  const parsedReindex = ReindexRequestSchema.safeParse(reindexPayload);
  assert.equal(parsedReindex.success, true, "Valid reindex request must parse");
  console.log(
    "  ✓ ReindexRequestSchema verified reindexing operation parameters",
  );

  // ---------------------------------------------------------------------------
  // TEST 6: Zero-Downtime Blue/Green Aliasing & Drift Reconciliation
  // ---------------------------------------------------------------------------
  await runReindexDriftReconciliationTests();

  console.log("\n==================================================");
  console.log("🎉 ALL SEARCH SERVICE SQA TESTS PASSED (100%)");
  console.log("==================================================");
}

runSearchServiceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Search service tests failed:", err);
    process.exit(1);
  });
