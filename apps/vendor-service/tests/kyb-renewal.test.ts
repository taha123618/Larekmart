import assert from "node:assert/strict";
import { KybRenewalService } from "../src/modules/documents/kyb-renewal.service.js";

console.log("=== vendor-service KYB Expiration & Renewal Tests ===");

const service = new KybRenewalService();

const soon = new Date(Date.now() + 5 * 86400_000).toISOString();
const evalSoon = service.evaluateKybExpiration("vnd_1", soon);
assert.equal(evalSoon.reminderTier, "CRITICAL_7D");
assert.equal(evalSoon.requiresAction, true);

const past = new Date(Date.now() - 2 * 86400_000).toISOString();
const evalPast = service.evaluateKybExpiration("vnd_1", past);
assert.equal(evalPast.reminderTier, "EXPIRED");

const future = new Date(Date.now() + 180 * 86400_000).toISOString();
const renewal = service.submitDocumentRenewal({
  vendorId: "vnd_1",
  documentType: "TAX_CERTIFICATE",
  documentUrl: "https://cdn.larekmart.com/docs/ntn-2026.pdf",
  expiresAt: future,
  riskScore: 82,
});
assert.equal(renewal.reminderTier, "VALID");
assert.equal(renewal.reverificationRequired, true);
assert.equal(service.getVendorRenewals("vnd_1").length, 1);
console.log("  ✔ KYB expiration tiers, renewal, and risk-based re-verification verified");
