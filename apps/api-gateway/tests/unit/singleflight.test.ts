import assert from "node:assert/strict";
import { SingleFlightGroup } from "../../src/resilience/singleflight.js";

export async function runSingleFlightTests() {
  console.log("▶ [UNIT] Running SingleFlight Thundering Herd tests...");

  const group = new SingleFlightGroup();

  // Test 1: 50 Concurrent callers coalesced into exactly 1 execution
  let executionCount = 0;
  const slowOperation = async () => {
    executionCount++;
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { data: "stock-available-150", timestamp: 123456 };
  };

  const concurrentPromises = Array.from({ length: 50 }).map(() =>
    group.do("inv:stock:42", slowOperation, { label: "test-inventory" }),
  );

  const results = await Promise.all(concurrentPromises);

  assert.equal(
    executionCount,
    1,
    `Expected exactly 1 execution for 50 concurrent callers, got ${executionCount}`,
  );
  assert.equal(results.length, 50);
  for (const res of results) {
    assert.deepEqual(res, {
      data: "stock-available-150",
      timestamp: 123456,
    });
  }

  // Registry must be clean after all callers resolve
  assert.equal(group.getStats().inflightCount, 0);

  // Test 2: Sequential call after resolution executes fresh
  const sequentialResult = await group.do("inv:stock:42", slowOperation);
  assert.equal(
    executionCount,
    2,
    "Sequential call after in-flight completion must execute anew",
  );
  assert.deepEqual(sequentialResult, {
    data: "stock-available-150",
    timestamp: 123456,
  });

  // Test 3: Error propagation & cleanup across all concurrent waiters
  let failExecutionCount = 0;
  const failingOperation = async () => {
    failExecutionCount++;
    await new Promise((resolve) => setTimeout(resolve, 40));
    throw new Error("Downstream PostgreSQL connection timed out");
  };

  const failingPromises = Array.from({ length: 25 }).map(() =>
    group.do("failing:key", failingOperation),
  );

  const settled = await Promise.allSettled(failingPromises);
  assert.equal(
    failExecutionCount,
    1,
    "Failing operation must only execute once",
  );
  assert.equal(settled.length, 25);
  for (const s of settled) {
    assert.equal(s.status, "rejected");
    if (s.status === "rejected") {
      assert.equal(
        s.reason.message,
        "Downstream PostgreSQL connection timed out",
      );
    }
  }

  // Registry must be clean even after rejection
  assert.equal(group.getStats().inflightCount, 0);

  // Test 4: Independent keys execute concurrently without cross-talk
  let countA = 0;
  let countB = 0;

  const [resA, resB] = await Promise.all([
    group.do("product:A", async () => {
      countA++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "Result A";
    }),
    group.do("product:B", async () => {
      countB++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "Result B";
    }),
  ]);

  assert.equal(countA, 1);
  assert.equal(countB, 1);
  assert.equal(resA, "Result A");
  assert.equal(resB, "Result B");
  assert.equal(group.getStats().inflightCount, 0);

  // Test 5: Safety timeout detaches hanging in-flight key
  let hungCount = 0;
  const hungOperation = async () => {
    hungCount++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return "completed-late";
  };

  // Launch operation with short timeoutMs of 50ms
  const p1 = group.do("hanging:key", hungOperation, { timeoutMs: 50 });

  // Wait 80ms for timeout to detach
  await new Promise((resolve) => setTimeout(resolve, 80));

  // The key should have been detached
  assert.equal(group.getStats().inflightCount, 0);

  // Next caller should now be able to initiate fresh without being permanently blocked
  let freshCount = 0;
  const p2 = group.do("hanging:key", async () => {
    freshCount++;
    return "fresh-value";
  });

  const res2 = await p2;
  assert.equal(res2, "fresh-value");
  assert.equal(freshCount, 1);

  // Wait for p1 to finish gracefully
  await p1;

  console.log("✔ [UNIT] SingleFlight Thundering Herd tests passed");
}
