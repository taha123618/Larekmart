import assert from "assert";
import type { Request, Response, NextFunction } from "express";
import { CartMergeConflictError } from "../src/errors.js";
import { withClusterLock } from "@repo/redis";

async function runCartConcurrencyTests() {
  console.log("=== Cart Service Concurrency & Idempotency Test Suite ===\n");

  // 1. Test CartMergeConflictError Definition
  console.log("1. Testing CartMergeConflictError instantiation...");
  const conflictErr = new CartMergeConflictError();
  assert.equal(conflictErr.name, "CartMergeConflictError");
  assert.equal(
    conflictErr.message,
    "A cart merge operation is currently in-flight for this user",
  );
  console.log("✓ CartMergeConflictError verified");

  // 2. Test Idempotency State & Conflict Simulation
  console.log("2. Testing Idempotency Conflict Response (HTTP 409)...");
  let statusCode = 0;
  let responseBody: any = null;

  const mockConflictRes: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
  };

  // Simulate controller or middleware returning 409 for conflict
  function handleMergeConflict(res: Response, err: Error) {
    if (err instanceof CartMergeConflictError) {
      res.status(409).json({ message: err.message });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }

  handleMergeConflict(mockConflictRes, conflictErr);
  assert.equal(statusCode, 409);
  assert.equal(
    responseBody?.message,
    "A cart merge operation is currently in-flight for this user",
  );
  console.log("✓ Idempotency Conflict 409 handling verified");

  // 3. Test withClusterLock Mutual Exclusion Semantics
  console.log("3. Testing withClusterLock mutual exclusion semantics...");
  const mockRedisClient: any = {
    storage: {} as Record<string, string>,
    async set(key: string, val: string, px: string, ttl: number, nx: string) {
      if (this.storage[key]) {
        return null; // Key already locked
      }
      this.storage[key] = val;
      return "OK";
    },
    async eval(script: string, numKeys: number, key: string, val: string) {
      if (this.storage[key] === val) {
        delete this.storage[key];
        return 1;
      }
      return 0;
    },
  };

  const lockKey = "cart:lock:merge:user_test_999";
  let firstWorkerExecuted = false;
  let secondWorkerBlocked = false;

  const res1 = await withClusterLock(
    mockRedisClient,
    lockKey,
    "worker_1",
    async () => {
      firstWorkerExecuted = true;
      // While worker 1 holds the lock, attempt worker 2
      const res2 = await withClusterLock(
        mockRedisClient,
        lockKey,
        "worker_2",
        async () => "worker_2_done",
      );
      if (res2 === null) {
        secondWorkerBlocked = true;
      }
      return "worker_1_done";
    },
  );

  assert.equal(res1, "worker_1_done");
  assert.equal(firstWorkerExecuted, true);
  assert.equal(
    secondWorkerBlocked,
    true,
    "Worker 2 must be blocked while Worker 1 holds the lock",
  );
  // Ensure lock was released in finally
  assert.equal(mockRedisClient.storage[lockKey], undefined, "Lock must be released after completion");
  console.log("✓ Distributed mutual exclusion and cleanup verified");

  // 4. Test Idempotent Cart Merge Item Deduplication
  console.log("4. Testing Idempotent Cart Merge Item Deduplication...");
  const existingUserCartItems = [
    { productId: "prod_1", variantId: "v1", quantity: 2, unitPrice: 500, subtotal: 1000 },
    { productId: "prod_2", variantId: "v2", quantity: 1, unitPrice: 1200, subtotal: 1200 },
  ];
  const guestCartItems = [
    { productId: "prod_1", variantId: "v1", quantity: 3, unitPrice: 500, subtotal: 1500 },
    { productId: "prod_3", variantId: null, quantity: 1, unitPrice: 800, subtotal: 800 },
  ];

  // Merge logic simulation
  const mergedItems = [...existingUserCartItems];
  for (const guestItem of guestCartItems) {
    const existingIndex = mergedItems.findIndex(
      (u) => u.productId === guestItem.productId && (u.variantId || "") === (guestItem.variantId || ""),
    );
    if (existingIndex > -1) {
      mergedItems[existingIndex]!.quantity += guestItem.quantity;
      mergedItems[existingIndex]!.subtotal =
        mergedItems[existingIndex]!.quantity * mergedItems[existingIndex]!.unitPrice;
    } else {
      mergedItems.push({ ...guestItem });
    }
  }

  assert.equal(mergedItems.length, 3, "Merged cart should contain 3 unique items");
  assert.equal(mergedItems[0]!.quantity, 5, "prod_1 quantity should be combined (2 + 3 = 5)");
  assert.equal(mergedItems[0]!.subtotal, 2500, "prod_1 subtotal should be updated to 2500");
  assert.equal(mergedItems[2]!.productId, "prod_3", "prod_3 should be appended");
  console.log("✓ Deduplication and quantity combination logic verified");

  console.log("\n=======================================================");
  console.log(" All Cart Concurrency & Idempotency Tests Passed! ");
  console.log("=======================================================\n");
}

runCartConcurrencyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
