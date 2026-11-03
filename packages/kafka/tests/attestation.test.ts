import assert from "node:assert/strict";
import {
  createEventAttestation,
  verifyEventAttestation,
} from "../src/attestation";

console.log("Starting Event Attestation tests...");

// 1. Successful signing and verification
{
  const payload = {
    sessionId: "cs_test_12345",
    amount: 5000,
    userId: "user_abc_789",
  };

  const attestation = createEventAttestation(payload, "test-secret-key");
  assert.ok(attestation.signature, "Attestation signature must exist");
  assert.ok(attestation.timestamp, "Attestation timestamp must exist");
  assert.equal(attestation.signer, "payment-service");

  const result = verifyEventAttestation(
    { ...payload, attestation },
    "test-secret-key",
  );
  assert.equal(
    result.verified,
    true,
    "Signature verification must succeed with correct secret",
  );
}

// 2. Secret mismatch fails verification
{
  const payload = {
    sessionId: "cs_test_12345",
    amount: 5000,
    userId: "user_abc_789",
  };

  const attestation = createEventAttestation(payload, "secret-one");
  const result = verifyEventAttestation(
    { ...payload, attestation },
    "secret-two",
  );
  assert.equal(
    result.verified,
    false,
    "Signature verification must fail on secret mismatch",
  );
  assert.match(result.reason || "", /failed/i);
}

// 3. Tampered payload fails verification
{
  const payload = {
    sessionId: "cs_test_12345",
    amount: 5000,
    userId: "user_abc_789",
  };

  const attestation = createEventAttestation(payload, "test-secret");
  const result = verifyEventAttestation(
    { ...payload, amount: 9999, attestation }, // Tampered amount
    "test-secret",
  );
  assert.equal(
    result.verified,
    false,
    "Verification must fail when payload is tampered",
  );
}

// 4. Expired timestamp fails verification
{
  const payload = {
    sessionId: "cs_test_12345",
    amount: 5000,
    userId: "user_abc_789",
  };

  const attestation = createEventAttestation(payload, "test-secret");
  // Backdate timestamp by 10 minutes
  attestation.timestamp = new Date(Date.now() - 600_000).toISOString();

  const result = verifyEventAttestation(
    { ...payload, attestation },
    "test-secret",
    300_000, // 5 min max age
  );
  assert.equal(
    result.verified,
    false,
    "Verification must fail on expired timestamp",
  );
  assert.match(result.reason || "", /drift|expired/i);
}

// 5. Missing attestation fails verification
{
  const payload = {
    sessionId: "cs_test_12345",
    amount: 5000,
    userId: "user_abc_789",
  };

  const result = verifyEventAttestation(payload, "test-secret");
  assert.equal(
    result.verified,
    false,
    "Verification must fail on missing attestation",
  );
}

console.log("✓ All Event Attestation tests passed successfully!");
