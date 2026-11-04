import { Hono } from "hono";
import Stripe from "stripe";
import stripe from "../utils/stripe";
import { producer } from "../utils/kafka";
import { createEventAttestation } from "@repo/kafka";
import { createLogger, captureError } from "@repo/monitoring";

const logger = createLogger("payment-service:webhooks");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
const webhookRoute = new Hono();

webhookRoute.get("/", (c) => {
  return c.json({
    status: "ok webhook",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

webhookRoute.post("/stripe", async (c) => {
  const body = await c.req.text();
  const sig = c.req.header("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (error) {
    captureError(error, {
      serviceName: "payment-service",
      logger,
      context: "stripe.webhook.signatureVerification",
    });
    return c.json({ error: "Webhook verification failed!" }, 400);
  }

  logger.info(`Received Stripe webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
        );

        const amount = session.amount_total ?? 0;
        const attestation = createEventAttestation({
          sessionId: session.id,
          referenceId: session.id,
          amount,
          userId: session.client_reference_id,
        });

        await producer.send(
          "payment.successful",
          {
            value: {
              sessionId: session.id,
              referenceId: session.id,
              cartId: session.metadata?.cartId || null,
              reservationId: session.metadata?.reservationId || null,
              couponCode: session.metadata?.couponCode || null,
              taxCalculationId: session.metadata?.taxCalculationId || null,
              taxAmount: session.metadata?.taxAmount
                ? parseFloat(session.metadata.taxAmount)
                : 0,
              userId: session.client_reference_id,
              email: session.customer_details?.email,
              deviceFingerprint: session.metadata?.deviceFingerprint || null,
              amount,
              status: session.payment_status === "paid" ? "success" : "failed",
              products: lineItems.data.map((item) => ({
                name: item.description,
                quantity: item.quantity,
                price: item.price?.unit_amount,
              })),
              attestation,
            },
          },
          { key: session.id },
        );
        logger.info(
          `Dispatched payment.successful event for session: ${session.id}`,
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await producer.send(
          "payment.failed",
          {
            value: {
              sessionId: session.id,
              referenceId: session.id,
              cartId: session.metadata?.cartId || null,
              reservationId: session.metadata?.reservationId || null,
              userId: session.client_reference_id || null,
              deviceFingerprint: session.metadata?.deviceFingerprint || null,
              reason: "checkout_session_expired",
              timestamp: new Date().toISOString(),
            },
          },
          { key: session.id },
        );
        logger.info(
          `Dispatched payment.failed event for expired checkout session: ${session.id}`,
        );
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await producer.send(
          "payment.failed",
          {
            value: {
              paymentIntentId: intent.id,
              referenceId: intent.id,
              reservationId: intent.metadata?.reservationId || null,
              userId: intent.metadata?.userId || null,
              reason:
                intent.last_payment_error?.message || "payment_intent_failed",
              timestamp: new Date().toISOString(),
            },
          },
          { key: intent.id },
        );
        logger.info(
          `Dispatched payment.failed event for failed payment_intent: ${intent.id}`,
        );
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge?.id;
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        await producer.send("payment.dispute.created", {
          value: {
            stripeDisputeId: dispute.id,
            chargeId: chargeId || null,
            paymentIntentId: paymentIntentId || null,
            amount: dispute.amount / 100, // standard currency units
            currency: (dispute.currency || "usd").toUpperCase(),
            reason: dispute.reason || "bank_inquiry",
            status: dispute.status,
            timestamp: new Date().toISOString(),
          },
        });
        logger.info(
          `Dispatched payment.dispute.created event for stripeDisputeId: ${dispute.id}`,
        );
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        await producer.send("payment.dispute.closed", {
          value: {
            stripeDisputeId: dispute.id,
            status: dispute.status,
            won: dispute.status === "won",
            timestamp: new Date().toISOString(),
          },
        });
        logger.info(
          `Dispatched payment.dispute.closed event for stripeDisputeId: ${dispute.id} (status: ${dispute.status})`,
        );
        break;
      }

      default:
        break;
    }
    return c.json({ received: true });
  } catch (err) {
    captureError(err, {
      serviceName: "payment-service",
      logger,
      context: "stripe.webhook.eventProcessing",
    });
    return c.json({ error: "Failed to process Stripe webhook event" }, 500);
  }
});

export default webhookRoute;
