import assert from "node:assert/strict";
import {
  computeSellerSlaScorecard,
  recordStaffAuditEvent,
  getStaffAuditLogs,
} from "../src/services/seller-health.service.js";

console.log("=== seller-service SLA Scorecard & Staff Audit Tests ===");

const excellent = computeSellerSlaScorecard("sel_1", {
  actualAvgFulfillmentHours: 14,
  actualAvgResponseMinutes: 25,
  onTimeDispatchRate: 98.5,
  orderDefectRate: 0.4,
  vacationMode: false,
});
assert.equal(excellent.storeHealthGrade, "EXCELLENT");

const critical = computeSellerSlaScorecard("sel_2", {
  actualAvgFulfillmentHours: 50,
  actualAvgResponseMinutes: 120,
  onTimeDispatchRate: 78,
  orderDefectRate: 3.1,
  vacationMode: true,
});
assert.equal(critical.storeHealthGrade, "CRITICAL");
assert.equal(critical.vacationMode, true);
console.log("  ✔ Seller SLA scorecard & store health grading verified");

const audit = recordStaffAuditEvent("sel_1", "usr_owner_1", {
  action: "STAFF_ROLE_UPDATED",
  targetUserId: "usr_staff_2",
  details: { previousRole: "VIEWER", newRole: "CATALOG_MANAGER" },
});
assert.equal(audit.action, "STAFF_ROLE_UPDATED");
assert.equal(getStaffAuditLogs("sel_1").length, 1);
console.log("  ✔ Staff audit log recording & retrieval verified");
