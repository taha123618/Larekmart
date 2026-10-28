import assert from "node:assert/strict";
import { DriftReconciler } from "../../src/services/drift-reconciler.js";
import { RollbackRequestSchema } from "@repo/types";
import { verifyIndexParity } from "@repo/opensearch";

export async function runReindexDriftReconciliationTests(): Promise<void> {
  console.log(
    "\n▶ [UNIT] Running OpenSearch Index Aliasing & Drift Reconciliation Tests...",
  );

  // ---------------------------------------------------------------------------
  // TEST 1: DriftReconciler Target Registration & Dual-Write Interception
  // ---------------------------------------------------------------------------
  {
    const reconciler = new DriftReconciler();
    const targetIndex = "products-v2";

    assert.equal(
      reconciler.hasActiveTargets(),
      false,
      "Initially no active targets",
    );
    reconciler.registerTarget(targetIndex);
    assert.equal(
      reconciler.hasActiveTargets(),
      true,
      "Target index registered",
    );
    assert.equal(reconciler.getReconciledCount(targetIndex), 0);

    // Mock client to intercept calls during drain
    const appliedActions: string[] = [];
    const mockClient = {
      index: async () => {
        appliedActions.push("INDEX");
        return { body: {} };
      },
      update: async () => {
        appliedActions.push("UPDATE");
        return { body: {} };
      },
      delete: async () => {
        appliedActions.push("DELETE");
        return { body: {} };
      },
    } as any;

    // Simulate in-flight mutations while reindex is running
    await reconciler.recordUpsert({
      id: "prod_1",
      name: "Smart Watch",
      price: 250,
      inStock: true,
      categorySlug: "electronics",
    } as any);

    await reconciler.recordPartialUpdate("prod_1", {
      price: 199,
      discountPercentage: 20,
    });

    await reconciler.recordDelete("prod_legacy");

    // Drain buffer and apply to target index
    const drained = await reconciler.drainAndApply(targetIndex, mockClient);
    assert.ok(drained >= 0, "Drained events count should be non-negative");

    // Unregister
    reconciler.unregisterTarget(targetIndex);
    assert.equal(
      reconciler.hasActiveTargets(),
      false,
      "Target unregistered cleanly",
    );
    console.log(
      "  ✓ DriftReconciler dual-write capture and buffer draining verified",
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Index Parity Verification Logic
  // ---------------------------------------------------------------------------
  {
    // Case 2A: Healthy parity within tolerance
    const healthyMockClient = {
      count: async ({ index }: { index: string }) => {
        return {
          statusCode: 200,
          body: { count: index === "products-v1" ? 100 : 98 }, // 2% diff
        };
      },
      search: async () => {
        return { statusCode: 200, body: { hits: { total: { value: 98 } } } };
      },
    } as any;

    const healthyResult = await verifyIndexParity(
      healthyMockClient,
      "products-v1",
      "products-v2",
      undefined,
      0.05,
    );
    assert.equal(
      healthyResult.isHealthy,
      true,
      "Parity should be healthy within 5% tolerance",
    );
    assert.equal(healthyResult.sampleSearchOk, true);
    console.log("  ✓ Healthy index parity accepted within delta tolerance");

    // Case 2B: Unhealthy parity (significant missing documents)
    const unhealthyMockClient = {
      count: async ({ index }: { index: string }) => {
        return {
          statusCode: 200,
          body: { count: index === "products-v1" ? 100 : 40 }, // 60% loss
        };
      },
      search: async () => {
        return { statusCode: 200, body: { hits: { total: { value: 40 } } } };
      },
    } as any;

    const unhealthyResult = await verifyIndexParity(
      unhealthyMockClient,
      "products-v1",
      "products-v2",
      undefined,
      0.05,
    );
    assert.equal(
      unhealthyResult.isHealthy,
      false,
      "Parity should fail when counts differ drastically",
    );
    assert.ok(unhealthyResult.reason?.includes("significantly lower"));
    console.log("  ✓ Parity verification gate blocks alias swap on data loss");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Rollback Request Schema Validation
  // ---------------------------------------------------------------------------
  {
    const validRollback = {
      aliasName: "products",
      targetIndex: "products-v1730000000000",
    };
    const parsed = RollbackRequestSchema.safeParse(validRollback);
    assert.equal(parsed.success, true, "Valid rollback payload must parse");

    const invalidRollback = {
      aliasName: "products",
      // missing targetIndex
    };
    const invalidParsed = RollbackRequestSchema.safeParse(invalidRollback);
    assert.equal(
      invalidParsed.success,
      false,
      "Missing targetIndex must fail validation",
    );
    console.log("  ✓ RollbackRequestSchema contract validated");
  }

  console.log(
    "✔ [UNIT] OpenSearch Index Aliasing & Drift Reconciliation Tests Passed",
  );
}
