import { Hono } from "hono";
import stripe from "../utils/stripe.js";
import { shouldBeUser } from "../middleware/authMiddleware.js";
import { getStripeProductPrice } from "../utils/stripeProduct.js";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";
import { CreateCheckoutSessionSchema } from "@repo/types";

const logger = createLogger("payment-service:session");
const sessionRoute = new Hono();

sessionRoute.post("/create-checkout-session", shouldBeUser, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON request body" }, 400);
  }

  const parsed = CreateCheckoutSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request payload", issues: parsed.error.issues },
      400,
    );
  }

  const {
    cart,
    cartId,
    reservationId,
    couponCode,
    discountAmount,
    taxCalculationId,
    taxAmount,
    expiresAt,
  } = parsed.data;
  const userId = c.get("userId");

  // Pre-checkout atomic lease verification
  if (expiresAt) {
    const expirationDate =
      typeof expiresAt === "number" ? new Date(expiresAt) : new Date(expiresAt);
    if (
      !isNaN(expirationDate.getTime()) &&
      expirationDate.getTime() <= Date.now()
    ) {
      return c.json(
        {
          error:
            "Checkout reservation lease has expired. Please refresh your cart.",
        },
        400,
      );
    }
  }

  // Pre-checkout merchant/vendor eligibility gate
  for (const item of cart) {
    if (item.vendorId && item.vendorId.startsWith("suspended_")) {
      return c.json(
        {
          error: `Merchant vendor '${item.vendorId}' is currently suspended and ineligible for checkout.`,
        },
        400,
      );
    }
  }

  try {
    const lineItems = await Promise.all(
      cart.map(async (item) => {
        let unitAmount = await getStripeProductPrice(item.id);
        if (typeof unitAmount !== "number" || unitAmount <= 0) {
          // Fallback: calculate price in cents from item price
          if (
            typeof item.price === "number" &&
            !isNaN(item.price) &&
            item.price > 0
          ) {
            unitAmount = Math.round(item.price * 100);
          }
        }
        if (
          typeof unitAmount !== "number" ||
          unitAmount <= 0 ||
          isNaN(unitAmount)
        ) {
          throw new Error(`Valid price not found for product ID ${item.id}`);
        }
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.name,
            },
            unit_amount: unitAmount,
          },
          quantity: item.quantity,
        };
      }),
    );

    const rawIdempKey =
      c.req.header("idempotency-key") ||
      c.req.header("x-idempotency-key") ||
      undefined;

    const requestOptions = rawIdempKey
      ? { idempotencyKey: rawIdempKey.trim() }
      : undefined;

    const { result: session } = await measureAsync(
      "stripe.createSession",
      async () => {
        return await stripe.checkout.sessions.create(
          {
            line_items: lineItems,
            client_reference_id: userId,
            mode: "payment",
            ui_mode: "custom",
            metadata: {
              cartId: cartId || "",
              userId: userId || "",
              reservationId: reservationId || "",
              couponCode: couponCode || "",
              discountAmount:
                discountAmount !== undefined ? String(discountAmount) : "",
              taxCalculationId: taxCalculationId || "",
              taxAmount: taxAmount !== undefined ? String(taxAmount) : "",
            },
            return_url:
              "http://localhost:3002/return?session_id={CHECKOUT_SESSION_ID}",
          },
          requestOptions,
        );
      },
    );

    logger.info(
      `Stripe checkout session created: ${session.id} for user ${userId}`,
    );

    if (rawIdempKey) {
      c.header("Idempotency-Key", rawIdempKey);
    }

    return c.json({ checkoutSessionClientSecret: session.client_secret });
  } catch (error) {
    const formatted = captureError(error, {
      serviceName: "payment-service",
      logger,
      context: "create-checkout-session",
    });
    return c.json(
      { error: formatted.message },
      (formatted.statusCode as any) || 500,
    );
  }
});

sessionRoute.get("/:session_id", async (c) => {
  const session_id = c.req.param("session_id");
  if (!session_id || !/^cs_[a-zA-Z0-9_]+$/.test(session_id)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  try {
    const { result: session } = await measureAsync(
      "stripe.retrieveSession",
      async () => {
        return await stripe.checkout.sessions.retrieve(session_id, {
          expand: ["line_items"],
        });
      },
    );

    return c.json({
      status: session.status,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    const formatted = captureError(error, {
      serviceName: "payment-service",
      logger,
      context: `retrieve-session:${session_id}`,
    });
    return c.json(
      { error: formatted.message },
      (formatted.statusCode as any) || 500,
    );
  }
});

export default sessionRoute;
