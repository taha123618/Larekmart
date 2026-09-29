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

/**
 * When a user is deleted, purge their active and saved carts and invalidate cache
 */
export const handleUserDeleted = async (payload: {
  userId?: string;
  [key: string]: unknown;
}): Promise<void> => {
  const { userId } = payload;
  if (!userId || typeof userId !== "string" || userId.trim() === "") return;

  try {
    await Cart.deleteMany({ userId });
    await invalidateCartCache({ userId });
    logger.info("Purged user carts after user.deleted event", { userId });
  } catch (err) {
    logger.error("Error purging carts for deleted user", err as Error, {
      userId,
    });
  }
};
