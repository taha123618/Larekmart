import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getPaymentProviderAdapter } from "../src/adapters/payment-provider.adapter.js";
import {
  reconcilePaymentBatch,
  recordCodCollection,
  remitCodCollection,
  getCodCollection,
} from "../src/services/reconciliation-cod.service.js";

console.log("=== payment-service Operations Unit Tests ===");

// 1. Multi-provider adapters
const jc = await getPaymentProviderAdapter("JAZZCASH").createPaymentIntent({
  orderId: "ord_jc_1",
  userId: "usr_1",
  amount: 2500,
  currency: "PKR",
});
assert.equal(jc.provider, "JAZZCASH");
assert.equal(jc.status, "REQUIRES_ACTION");
assert.ok(jc.redirectUrl?.includes("ord_jc_1"));

const cod = await getPaymentProviderAdapter("COD").createPaymentIntent({
  orderId: "ord_cod_1",
  userId: "usr_1",
  amount: 1500,
  currency: "PKR",
});
assert.equal(cod.status, "PENDING_COLLECTION");

const jcAdapter = getPaymentProviderAdapter("JAZZCASH");
const samplePayload = JSON.stringify({ orderId: "ord_jc_1", amount: 2500 });
const validSig = crypto
  .createHmac("sha256", process.env.JAZZCASH_INTEGRITY_SALT || "test_jazzcash_salt")
  .update(samplePayload)
  .digest("hex");
assert.equal(jcAdapter.verifySignature(samplePayload, validSig), true);
assert.equal(jcAdapter.verifySignature(samplePayload, "tampered_signature"), false);
console.log("  ✔ Multi-provider payment adapters & HMAC verification verified");

// 2. Payment reconciliation
const recon = reconcilePaymentBatch([
  {
    orderId: "ord_1",
    expectedAmount: 1000,
    settledAmount: 1000,
    currency: "PKR",
    provider: "STRIPE",
    providerReference: "pi_1",
  },
  {
    orderId: "ord_2",
    expectedAmount: 2000,
    settledAmount: 1850,
    currency: "PKR",
    provider: "JAZZCASH",
    providerReference: "jc_2",
  },
  {
    orderId: "ord_3",
    expectedAmount: 500,
    settledAmount: 0,
    currency: "PKR",
    provider: "EASYPAISA",
    providerReference: "ep_3",
  },
]);
assert.equal(recon.summary.matched, 1);
assert.equal(recon.summary.underpaid, 1);
assert.equal(recon.summary.missingSettlement, 1);
assert.equal(recon.summary.totalDiscrepancy, -650);
console.log("  ✔ Payment reconciliation batch discrepancies verified");

// 3. COD collection & remittance lifecycle
const collected = recordCodCollection({
  orderId: "ord_cod_2",
  courierId: "courier_tcs_1",
  expectedAmount: 3200,
  collectedAmount: 3200,
  currency: "PKR",
});
assert.equal(collected.status, "COLLECTED_BY_COURIER");

const remitted = remitCodCollection({
  orderId: "ord_cod_2",
  remittedAmount: 3200,
  settlementBatchId: "batch_9001",
});
assert.equal(remitted.status, "REMITTED_TO_MARKETPLACE");
assert.equal(getCodCollection("ord_cod_2")?.remittedAmount, 3200);
console.log("  ✔ COD collection & marketplace remittance lifecycle verified");
