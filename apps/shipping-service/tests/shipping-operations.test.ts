import assert from "node:assert/strict";
import {
  recordDeliveryAttempt,
  getShipmentAttempts,
  getCourierPerformanceMetrics,
  scheduleReturnPickup,
  updateReturnPickupStatus,
} from "../src/services/shipping-operations.service.js";

console.log("=== shipping-service Operations Unit Tests ===");

// 1. Delivery attempts & failed delivery RTO escalation
const att1 = recordDeliveryAttempt("shp_1", {
  carrier: "tcs",
  outcome: "FAILED_RECIPIENT_UNAVAILABLE",
  notes: "Gate closed",
});
assert.equal(att1.attemptNumber, 1);
assert.equal(att1.nextAction, "RETRY_SCHEDULED");

const att2 = recordDeliveryAttempt("shp_1", {
  carrier: "tcs",
  outcome: "FAILED_ADDRESS_ISSUE",
});
assert.equal(att2.nextAction, "RETRY_SCHEDULED");

const att3 = recordDeliveryAttempt("shp_1", {
  carrier: "tcs",
  outcome: "FAILED_RECIPIENT_UNAVAILABLE",
});
assert.equal(att3.attemptNumber, 3);
assert.equal(att3.nextAction, "RETURN_TO_ORIGIN");
assert.equal(getShipmentAttempts("shp_1").length, 3);
console.log("  ✔ Delivery attempts & 3-strike RTO escalation verified");

// 2. Courier performance aggregation
const attDhl = recordDeliveryAttempt("shp_2", {
  carrier: "dhl",
  outcome: "DELIVERED",
});
assert.equal(attDhl.nextAction, "COMPLETED");
const perf = getCourierPerformanceMetrics();
const dhlMetrics = perf.find((c) => c.carrier === "DHL");
assert.equal(dhlMetrics?.firstAttemptSuccessRate, 100);
console.log("  ✔ Courier performance metrics verified");

// 3. Return pickup lifecycle
const pickup = scheduleReturnPickup({
  returnId: "ret_1",
  orderId: "ord_1",
  carrier: "leopards",
  pickupAddress: "123 Clifton Block 4, Karachi",
  scheduledDate: "2026-11-28",
});
assert.equal(pickup.status, "SCHEDULED");
const updated = updateReturnPickupStatus(pickup.pickupId, "PICKED_UP");
assert.equal(updated.status, "PICKED_UP");
console.log("  ✔ Return pickup scheduling & lifecycle verified");
