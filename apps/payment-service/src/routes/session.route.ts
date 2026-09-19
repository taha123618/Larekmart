import { Hono } from "hono";
import stripe from "../utils/stripe";
import { shouldBeUser } from "../middleware/authMiddleware";
import { CartItemsType } from "@repo/types";
import { getStripeProductPrice } from "../utils/stripeProduct";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

const logger = createLogger("payment-service:session");
const sessionRoute = new Hono();

sessionRoute.post("/create-checkout-session", shouldBeUser, async (c) => {
  const { cart, cartId }: { cart: CartItemsType; cartId?: string } =
    await c.req.json();
  const userId = c.get("userId");

  try {
    const lineItems = await Promise.all(
      cart.map(async (item) => {
        const unitAmount = await getStripeProductPrice(item.id);
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.name,
            },
            unit_amount: unitAmount as number,
          },
          quantity: item.quantity,
        };
      }),
    );

    const { result: session } = await measureAsync(
      "stripe.createSession",
      async () => {
        return await stripe.checkout.sessions.create({
          line_items: lineItems,
          client_reference_id: userId,
          mode: "payment",
          ui_mode: "custom",
          metadata: {
            cartId: cartId || "",
            userId: userId || "",
          },
          return_url:
            "http://localhost:3002/return?session_id={CHECKOUT_SESSION_ID}",
        });
      },
    );

    logger.info(
      `Stripe checkout session created: ${session.id} for user ${userId}`,
    );

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
  const { session_id } = c.req.param();
  try {
    const { result: session } = await measureAsync(
      "stripe.retrieveSession",
      async () => {
        return await stripe.checkout.sessions.retrieve(session_id as string, {
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
