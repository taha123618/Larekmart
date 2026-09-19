import { Cart, ProcessedEvent } from "@repo/cart-db";
import { logger } from "../observability/metrics.js";
import { invalidateCartCache } from "../cache/cart-cache.js";

interface OrderEventPayload {
  orderId?: string;
  userId?: string;
  cartId?: string;
  [key: string]: unknown;
}

/**
 * When an order or payment is successfully placed, transition user's active cart to converted
 */
export const handleOrderCreated = async (
  payload: OrderEventPayload,
): Promise<void> => {
  const { userId, cartId, orderId } = payload;
  if (!userId && !cartId) return;

  const eventId = `order_conv_${orderId || cartId || userId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    const filter = cartId
      ? { _id: cartId, status: "active" }
      : { userId, status: "active" };

    const cart = await Cart.findOne(filter);
    if (cart) {
      cart.status = "converted";
      cart.version = (cart.version || 1) + 1;
      await cart.save();

      await invalidateCartCache({
        userId: cart.userId,
        guestToken: cart.guestToken,
      });
      logger.info("Converted active cart to converted after order placement", {
        cartId: cart._id.toString(),
        userId: cart.userId,
        orderId,
      });
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "order.created",
      aggregateId:
        (orderId as string) || (cartId as string) || (userId as string),
    });
  } catch (err) {
    logger.error(
      "Error converting cart on order event in cart-service",
      err as Error,
      {
        userId,
        orderId,
      },
    );
  }
};
