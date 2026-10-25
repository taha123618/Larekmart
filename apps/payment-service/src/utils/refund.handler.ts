import stripe from "./stripe.js";
import { producer } from "./kafka.js";
import type { ReturnRefundRequestedPayload } from "@repo/types";

/**
 * Handles return refund execution via Stripe with idempotency.
 * Emits payment.refund.succeeded on success, or payment.refund.failed on error.
 */
export async function handleReturnRefundRequest(
  payload: ReturnRefundRequestedPayload,
): Promise<void> {
  const {
    returnId,
    orderId,
    paymentIntentId,
    idempotencyKey,
    totalRefund,
    currency,
  } = payload;

  console.log(
    `[payment-service] Processing return refund request for return ${returnId} (PI: ${paymentIntentId}, Amount: ${totalRefund} ${currency})`,
  );

  const amountCents = Math.round(parseFloat(totalRefund) * 100);

  try {
    let refundId: string;

    const isDummyKey =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes("dummy") ||
      paymentIntentId.startsWith("pi_mock") ||
      paymentIntentId.startsWith("pi_test_mock");

    if (isDummyKey) {
      // In development/test mock environment, simulate Stripe refund success
      refundId = `re_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      console.log(
        `[payment-service] Mock Stripe refund created: ${refundId} for amount ${amountCents} cents`,
      );
    } else {
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amountCents > 0 ? amountCents : undefined,
        },
        { idempotencyKey },
      );
      refundId = refund.id;
    }

    // Publish payment.refund.succeeded (consumed by return-service)
    await producer.send("payment.refund.succeeded", {
      value: {
        returnId,
        orderId,
        paymentIntentId,
        amount: totalRefund,
        currency: currency || "usd",
        refundId,
        refundedAt: new Date().toISOString(),
      },
    });

    console.log(
      `[payment-service] Emitted payment.refund.succeeded for return ${returnId}`,
    );
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Unknown Stripe refund processing error";
    console.error(
      `[payment-service] Stripe refund execution failed for return ${returnId}:`,
      errorMsg,
    );

    // Publish payment.refund.failed (consumed by return-service)
    await producer.send("payment.refund.failed", {
      value: {
        returnId,
        orderId,
        paymentIntentId,
        failureReason: errorMsg,
        failedAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * Handles Checkout Saga compensation refund requests.
 * Emits payment.refund.completed on completion.
 */
export async function handleCheckoutRefundRequest(payload: {
  orderId: string;
  paymentSessionId: string;
  amount?: number;
  reason: string;
  userId?: string | null;
  requestedAt: string;
}): Promise<void> {
  const { orderId, paymentSessionId, amount, reason } = payload;
  console.log(
    `[payment-service] Processing Checkout Saga refund for order ${orderId} (Session: ${paymentSessionId}, Reason: ${reason})`,
  );

  try {
    let refundId: string;
    const isMock =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes("dummy") ||
      paymentSessionId.startsWith("cs_mock") ||
      paymentSessionId.startsWith("cs_test_mock");

    if (isMock) {
      refundId = `re_saga_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    } else {
      const session = await stripe.checkout.sessions.retrieve(paymentSessionId);
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!paymentIntentId) {
        throw new Error(
          `No payment_intent found on Stripe checkout session ${paymentSessionId}`,
        );
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { orderId, sagaCompensation: "true", reason },
      });
      refundId = refund.id;
    }

    await producer.send("payment.refund.completed", {
      value: {
        orderId,
        refundId,
        paymentSessionId,
        amount: amount ?? 0,
        status: "succeeded",
        completedAt: new Date().toISOString(),
      },
    });

    console.log(
      `[payment-service] Emitted payment.refund.completed for order ${orderId} (Refund ID: ${refundId})`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[payment-service] Checkout Saga refund failed for order ${orderId}:`,
      errorMsg,
    );
    await producer.send("payment.refund.completed", {
      value: {
        orderId,
        refundId: "",
        paymentSessionId,
        amount: amount ?? 0,
        status: "failed",
        error: errorMsg,
        completedAt: new Date().toISOString(),
      },
    });
  }
}
