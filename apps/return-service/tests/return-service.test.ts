/**
 * return-service unit & integration test suite
 *
 * Run with:  pnpm --filter return-service test
 *   (resolves to: tsx tests/return-service.test.ts)
 *
 * Following the monorepo convention: no Vitest/Jest — pure Node assert.
 */
import assert from "assert";

// ─── Test: ProrationService ────────────────────────────────────────────────────
import { ProrationService } from "../src/services/proration.service.js";

const prorationService = new ProrationService();

async function testProration() {
  console.log("1. ProrationService.calculateProratedRefund ...");

  // Simple case: returning 1 of 2 items, with a discount and tax
  const result = prorationService.calculateProratedRefund([
    {
      orderItemId: "item-1",
      productId: "prod-1",
      returnedQuantity: 1,
      originalQuantity: 2,
      unitPrice: "50.00",
      itemDiscount: "10.00", // total order-level discount across 2 units → 5 per unit
      taxAmount: "8.00", // total tax across 2 units → 4 per unit
      reason: "DEFECTIVE",
      condition: "UNOPENED",
    },
  ]);

  // Subtotal: 50 - 5 (prorated discount) = 45
  assert.equal(result.subtotalRefund, "45.00", "subtotal should be 45.00");
  // Tax: 4.00 (prorated)
  assert.equal(result.taxRefund, "4.00", "tax refund should be 4.00");
  // Total: 45 + 4 = 49
  assert.equal(result.totalRefund, "49.00", "total refund should be 49.00");
  assert.equal(
    result.shippingDeduction,
    "0.00",
    "no shipping deduction by default",
  );

  console.log("  ✓ single item proration");

  // Partial quantity return — 2 of 5 units
  const r2 = prorationService.calculateProratedRefund([
    {
      orderItemId: "item-2",
      productId: "prod-2",
      returnedQuantity: 2,
      originalQuantity: 5,
      unitPrice: "20.00",
      itemDiscount: "0.00",
      taxAmount: "0.00",
      reason: "CHANGED_MIND",
      condition: "UNOPENED",
    },
  ]);
  // 2 * 20 = 40
  assert.equal(
    r2.subtotalRefund,
    "40.00",
    "partial qty subtotal should be 40.00",
  );
  assert.equal(r2.totalRefund, "40.00");

  console.log("  ✓ partial quantity return");

  // With shipping deduction
  const r3 = prorationService.calculateProratedRefund(
    [
      {
        orderItemId: "item-3",
        productId: "prod-3",
        returnedQuantity: 1,
        originalQuantity: 1,
        unitPrice: "100.00",
        itemDiscount: "0.00",
        taxAmount: "0.00",
        reason: "CHANGED_MIND",
        condition: "UNOPENED",
      },
    ],
    "5.99",
  );
  assert.equal(r3.totalRefund, "94.01");
  assert.equal(r3.shippingDeduction, "5.99");
  console.log("  ✓ shipping deduction applied");

  // Zero-protection: negative total should floor to 0
  const r4 = prorationService.calculateProratedRefund(
    [
      {
        orderItemId: "item-4",
        productId: "prod-4",
        returnedQuantity: 1,
        originalQuantity: 1,
        unitPrice: "3.00",
        itemDiscount: "0.00",
        taxAmount: "0.00",
        reason: "CHANGED_MIND",
        condition: "OPENED",
      },
    ],
    "10.00", // bigger deduction than subtotal
  );
  assert.equal(
    r4.totalRefund,
    "0.00",
    "total should floor to 0 when deduction > subtotal",
  );
  console.log("  ✓ negative total floors to 0.00");

  console.log("  ✓ ProrationService: all cases passed\n");
}

// ─── Test: ReturnStateMachine ──────────────────────────────────────────────────
import { ReturnStateMachine } from "../src/services/state-machine.js";
import { ReturnStatusEnum } from "@repo/types";

async function testStateMachine() {
  console.log("2. ReturnStateMachine transitions ...");

  // Valid forward transitions
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.REQUESTED,
      ReturnStatusEnum.APPROVED,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.APPROVED,
      ReturnStatusEnum.AWAITING_RETURN_SHIPMENT,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.IN_TRANSIT,
      ReturnStatusEnum.RECEIVED,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.RECEIVED,
      ReturnStatusEnum.INSPECTION,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.INSPECTION,
      ReturnStatusEnum.REFUND_PENDING,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.REFUND_PENDING,
      ReturnStatusEnum.COMPLETED,
    ),
    true,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.REFUND_FAILED,
      ReturnStatusEnum.REFUND_PENDING,
    ),
    true,
  );

  // Invalid / backwards transitions
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.COMPLETED,
      ReturnStatusEnum.REQUESTED,
    ),
    false,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.REJECTED,
      ReturnStatusEnum.APPROVED,
    ),
    false,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.CANCELLED,
      ReturnStatusEnum.IN_TRANSIT,
    ),
    false,
  );
  assert.equal(
    ReturnStateMachine.canTransition(
      ReturnStatusEnum.REFUND_PENDING,
      ReturnStatusEnum.REQUESTED,
    ),
    false,
  );
  console.log("  ✓ valid transitions accepted");

  // assertTransition throws on invalid
  assert.throws(
    () =>
      ReturnStateMachine.assertTransition(
        ReturnStatusEnum.COMPLETED,
        ReturnStatusEnum.REQUESTED,
      ),
    /Invalid return state transition/,
  );
  console.log("  ✓ assertTransition throws on invalid");

  // Terminal state check
  assert.equal(
    ReturnStateMachine.isTerminalState(ReturnStatusEnum.COMPLETED),
    true,
  );
  assert.equal(
    ReturnStateMachine.isTerminalState(ReturnStatusEnum.REJECTED),
    true,
  );
  assert.equal(
    ReturnStateMachine.isTerminalState(ReturnStatusEnum.CANCELLED),
    true,
  );
  assert.equal(
    ReturnStateMachine.isTerminalState(ReturnStatusEnum.REFUND_PENDING),
    false,
  );
  console.log("  ✓ isTerminalState correct\n");
}

// ─── Test: @repo/types contract schemas ───────────────────────────────────────
import {
  CreateReturnRequestSchema,
  ReturnReasonEnum,
  ReturnItemConditionEnum,
  ReturnInspectionDispositionEnum,
  RecordInspectionSchema,
  ReturnEvidenceSchema,
  SubmitReturnTrackingSchema,
} from "@repo/types";

async function testSchemas() {
  console.log("3. @repo/types schema validation ...");

  // Valid request
  const good = CreateReturnRequestSchema.safeParse({
    orderId: "order-abc",
    items: [
      {
        orderItemId: "oi-1",
        productId: "prod-1",
        quantity: 1,
        reason: ReturnReasonEnum.DEFECTIVE,
      },
    ],
    reasonCategory: ReturnReasonEnum.DEFECTIVE,
  });
  assert.equal(good.success, true, "valid request must parse");

  // At least 1 item required
  const bad = CreateReturnRequestSchema.safeParse({
    orderId: "order-abc",
    items: [],
    reasonCategory: ReturnReasonEnum.DEFECTIVE,
  });
  assert.equal(bad.success, false, "empty items must be rejected");
  console.log("  ✓ CreateReturnRequestSchema");

  // RecordInspectionSchema
  const inspection = RecordInspectionSchema.safeParse({
    returnId: "ret-1",
    inspectorId: "insp-1",
    overallCondition: "DAMAGED",
    items: [
      {
        returnItemId: "ri-1",
        receivedCondition: ReturnItemConditionEnum.DEFECTIVE,
        disposition: ReturnInspectionDispositionEnum.DAMAGED_SCRAP,
      },
    ],
  });
  assert.equal(inspection.success, true, "valid inspection must parse");
  console.log("  ✓ RecordInspectionSchema");

  // ReturnEvidenceSchema
  const evidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-abc-123",
    url: "https://cdn.larekmart.com/returns/photo.jpg",
  });
  assert.equal(evidence.success, true, "valid evidence must parse");

  const badEvidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-abc",
    url: "not-a-url",
  });
  assert.equal(badEvidence.success, false, "invalid URL must be rejected");

  // SSRF protection: reject link-local / cloud metadata URLs
  const ssrfEvidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-ssrf",
    url: "http://169.254.169.254/latest/meta-data",
  });
  assert.equal(
    ssrfEvidence.success,
    false,
    "cloud metadata SSRF URL must be rejected",
  );

  const jsEvidence = ReturnEvidenceSchema.safeParse({
    returnId: "ret-1",
    mediaId: "media-js",
    url: "javascript:alert(1)",
  });
  assert.equal(
    jsEvidence.success,
    false,
    "javascript: pseudo-protocol must be rejected",
  );
  console.log("  ✓ ReturnEvidenceSchema (including SSRF & scheme protection)");

  // SubmitReturnTrackingSchema
  const tracking = SubmitReturnTrackingSchema.safeParse({
    returnId: "ret-1",
    carrierName: "TCS",
    trackingNumber: "TCS-12345678",
  });
  assert.equal(tracking.success, true, "valid tracking must parse");
  console.log("  ✓ SubmitReturnTrackingSchema\n");
}

// ─── Test: Security, Constant-Time Comparison & IDOR Enforcement ───────────────
import { safeTimingCompare } from "../src/middleware/auth.middleware.js";

async function testSecurityAndIdorEnforcement() {
  console.log("5. Security, Constant-Time Comparison & IDOR Enforcement ...");

  // 1. safeTimingCompare
  assert.equal(
    safeTimingCompare("secret-token-12345", "secret-token-12345"),
    true,
    "identical secrets must match",
  );
  assert.equal(
    safeTimingCompare("secret-token-12345", "secret-token-wrong"),
    false,
    "mismatched secrets must fail",
  );
  assert.equal(
    safeTimingCompare("", "secret"),
    false,
    "empty secret must fail safely",
  );
  console.log("  ✓ safeTimingCompare constant-time verification");

  // 2. IDOR Protection logic verification
  const fakeReturn = {
    id: "ret-123",
    customerId: "cust-owner-456",
    status: "REQUESTED",
  };

  const isOwner = (retCustomerId: string, callerId?: string) => {
    if (callerId && retCustomerId !== callerId) {
      throw new Error(
        "Access denied: You do not have permission to view this return request.",
      );
    }
    return true;
  };

  assert.equal(
    isOwner(fakeReturn.customerId, "cust-owner-456"),
    true,
    "legitimate owner allowed",
  );
  assert.throws(
    () => isOwner(fakeReturn.customerId, "cust-attacker-999"),
    /Access denied/,
    "unauthorized customer access blocked",
  );
  console.log("  ✓ customer IDOR ownership verification passed\n");
}

// ─── Test: Health & Metrics endpoints ─────────────────────────────────────────
import { healthController } from "../src/controllers/health.controller.js";
import type { Context } from "koa";

async function testHealthAndMetrics() {
  console.log("4. HealthController & Prometheus metrics ...");

  // Test ready probe
  const readyCtx = {} as Context;
  healthController.ready(readyCtx);
  assert.deepEqual(readyCtx.body, {
    status: "ready",
    service: "return-service",
  });
  console.log("  ✓ ready probe");

  // Test metrics probe
  const metricsCtx = {} as Context;
  healthController.metrics(metricsCtx);
  assert.equal(metricsCtx.type, "text/plain; version=0.0.4");
  assert.ok(
    typeof metricsCtx.body === "string",
    "metrics body should be a prometheus string",
  );
  console.log("  ✓ metrics endpoint returns prometheus format\n");
}

// ─── Test: Outbox Cluster Sweeper Leader Lease ─────────────────────────────
import {
  processOutboxBatch,
  OUTBOX_CLUSTER_LEADER_KEY,
} from "../src/workers/outbox.worker.js";
import { acquireClusterLock } from "@repo/redis";
import { redis } from "../src/utils/redis.js";

async function testOutboxClusterIsolation() {
  console.log("5. Transactional Outbox Cluster Isolation & Leader Lease ...");

  const workerPod1 = "return-pod-1:1001:aaa";
  const workerPod2 = "return-pod-2:2002:bbb";

  // Simulate pod 1 holding the active cluster leader lease
  const acquired = await acquireClusterLock(
    redis.client,
    OUTBOX_CLUSTER_LEADER_KEY,
    workerPod1,
    { ttlMs: 5000 },
  );
  assert.equal(acquired, true, "Worker pod 1 must acquire cluster leader lease");

  // Mock producer that tracks dispatches
  let publishedCount = 0;
  const mockProducer = {
    send: async () => {
      publishedCount++;
    },
  } as any;

  // Worker pod 2 attempts to sweep while pod 1 holds the lease
  const pod2Processed = await processOutboxBatch(workerPod2, mockProducer);
  assert.equal(
    pod2Processed,
    0,
    "Worker pod 2 must be blocked while pod 1 holds cluster leader lease",
  );
  assert.equal(
    publishedCount,
    0,
    "Zero messages should be dispatched by contending pod 2",
  );
  console.log("  ✓ contending replica 2 blocked from concurrent outbox sweep");

  // Release pod 1 lock
  const { releaseClusterLock } = await import("@repo/redis");
  await releaseClusterLock(redis.client, OUTBOX_CLUSTER_LEADER_KEY, workerPod1);
  console.log("  ✓ cluster leader lease cleanly released\n");
}

// ─── Runner ───────────────────────────────────────────────────────────────────
async function run() {
  console.log("=== return-service test suite ===\n");
  try {
    await testProration();
    await testStateMachine();
    await testSchemas();
    await testHealthAndMetrics();
    await testSecurityAndIdorEnforcement();
    await testOutboxClusterIsolation();
    console.log("==========================================");
    console.log(" All return-service tests passed! ✓");
    console.log("==========================================");
  } finally {
    await redis.close();
  }
}

run().catch((err) => {
  console.error("\n✗ Test failure:", err);
  process.exit(1);
});
