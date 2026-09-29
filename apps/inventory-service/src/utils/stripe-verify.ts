import Stripe from "stripe";

/**
 * Application-level payment verification for inventory confirmation
 * (audit lead inventory-consumer-unverified-producer).
 *
 * The `payment.successful` Kafka topic is a domain *claim*, not proof. Even
 * with broker SASL/ACLs, any producer with valid credentials could publish a
 * forged event. Before converting reserved stock to sold stock, the
 * reservation reference is cross-checked against Stripe itself: only a
 * checkout session that Stripe reports as `payment_status: "paid"` may
 * confirm reservations.
 */

let stripeClient: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!stripeClient) {
    stripeClient = new Stripe(
      process.env.STRIPE_SECRET_KEY!,
      { apiVersion: "2025-08-27.basil" },
    );
  }
  return stripeClient;
};

export const resetStripeClientForTests = (): void => {
  stripeClient = null;
};

export interface PaymentVerificationResult {
  verified: boolean;
  /** Human-readable reason when verification fails; for logs/metrics. */
  reason?: string;
}

/**
 * Verifies that the given checkout session exists and is actually paid.
 * `referenceId` is the reservation's reference (Stripe session id in the
 * normal flow). Fails closed: any Stripe error, unknown session, or non-paid
 * status blocks confirmation.
 */
export async function verifyPaidCheckoutSession(
  referenceId: string,
): Promise<PaymentVerificationResult> {
  // Checkout session ids are `cs_...`; anything else cannot be a Stripe
  // session and is rejected without a network round-trip.
  if (!referenceId || !referenceId.startsWith("cs_")) {
    return {
      verified: false,
      reason: `reference "${referenceId.slice(0, 12)}…" is not a Stripe checkout session id`,
    };
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(referenceId);
    if (session.payment_status !== "paid") {
      return {
        verified: false,
        reason: `session payment_status is "${session.payment_status}", not "paid"`,
      };
    }
    return { verified: true };
  } catch (error) {
    return {
      verified: false,
      reason: `Stripe lookup failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
