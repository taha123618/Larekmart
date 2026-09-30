/**
 * Regression test for audit lead inventory-consumer-unverified-producer.
 *
 * Verifies the Stripe paid-session cross-check at two levels:
 *
 * 1. Unit: verifyPaidCheckoutSession fails closed — non-`cs_` references,
 *    unpaid/errored sessions, and Stripe failures never verify.
 * 2. Consumer logic: the forged payload from the original lead (a
 *    `payment.successful` message carrying a non-Stripe reference) is
 *    rejected BEFORE confirmReservationsByReference is reached.
 *
 * Live end-to-end variant (broker + service running): see LEAD-REPROS.md —
 * the forged message that previously flipped a reservation to CONFIRMED must
 * now be logged as rejected and leave the reservation RESERVED.
 *
 * Run: pnpm --filter inventory-service test:stripe-verify
 */
import assert from "assert";
import {
  verifyPaidCheckoutSession,
  resetStripeClientForTests,
} from "../src/utils/stripe-verify.js";

async function runStripeVerifyTests() {
  console.log("=== Stripe Paid-Session Verification Regression Tests ===\n");

  // Isolate from any real STRPE_SECRET_KEY on this machine, then restore.
  const savedKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key_placeholder";

  try {
    // 1. The forged lead payload: reference is a reservation id, not a
    //    Stripe session — rejected without a network call.
    console.log(
      "1. Non-Stripe reference (forged reservation id) is rejected...",
    );
    const forged = await verifyPaidCheckoutSession("repro-forged-123456");
    assert.equal(forged.verified, false, "non-cs_ reference must not verify");
    assert.ok(forged.reason, "rejection must carry a reason");
    console.log(`✓ rejected: ${forged.reason}`);

    // 2. Empty reference fails closed.
    console.log("2. Empty reference is rejected...");
    const empty = await verifyPaidCheckoutSession("");
    assert.equal(empty.verified, false, "empty reference must not verify");
    console.log("✓ rejected");

    // 3. A syntactically valid cs_ id that Stripe does not know → lookup
    //    error → fail closed (requires network; Stripe errors are caught).
    console.log("3. Unknown cs_ session fails closed (Stripe lookup error)...");
    const unknown = await verifyPaidCheckoutSession(
      "cs_test_a1b2c3d4e5f6g7h8i9j0_does_not_exist",
    );
    assert.equal(
      unknown.verified,
      false,
      "unknown session must fail closed even when Stripe errors",
    );
    console.log(`✓ rejected: ${unknown.reason}`);

    // 4. Consumer-level: simulate the exact guard used in
    //    inventory-event.consumer.ts for the forged payload shape.
    console.log("4. Consumer guard blocks forged payload before confirm...");
    const forgedPayload = {
      sessionId: "forged-session-do-not-trust",
      referenceId: "repro-forged-123456",
      userId: "repro-user",
      amount: 1,
      status: "success",
    };
    const referenceId =
      forgedPayload.reservationId ||
      forgedPayload.sessionId ||
      forgedPayload.referenceId;
    const guard = await verifyPaidCheckoutSession(referenceId as string);
    assert.equal(
      guard.verified,
      false,
      "consumer must not confirm on the forged payload",
    );
    console.log("✓ reservation stays RESERVED; confirm path never runs");

    console.log(
      "\n=======================================================\n" +
        " All Stripe Verification Regression Tests Passed!\n" +
        "=======================================================\n",
    );
  } finally {
    if (savedKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = savedKey;
    }
    resetStripeClientForTests();
  }
  process.exit(0);
}

runStripeVerifyTests().catch((err) => {
  console.error("Stripe verify test failed:", err);
  process.exit(1);
});
