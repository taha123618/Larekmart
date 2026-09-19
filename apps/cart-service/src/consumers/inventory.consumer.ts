import { Cart, ProcessedEvent } from "@repo/cart-db";
import { logger } from "../observability/metrics.js";
import { invalidateCartCache } from "../cache/cart-cache.js";

interface InventoryEventPayload {
  productId: string;
  variantId?: string;
  availableQuantity?: number;
  [key: string]: unknown;
}

export const handleInventoryAdjusted = async (
  payload: InventoryEventPayload,
): Promise<void> => {
  const { productId, availableQuantity } = payload;
  if (!productId || typeof availableQuantity !== "number") return;

  const eventId = `inv_adj_${productId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    if (availableQuantity === 0) {
      const affectedCarts = await Cart.find(
        { status: "active", "items.productId": productId },
        { userId: 1, guestToken: 1 },
      );

      // Out of stock: record adjustments in active carts
      await Cart.updateMany(
        { status: "active", "items.productId": productId },
        {
          $push: {
            adjustments: {
              itemId: productId,
              productId,
              reason: "Item is currently out of stock",
              oldQuantity: 1,
              newQuantity: 0,
              createdAt: new Date(),
            },
          },
        },
      );

      for (const c of affectedCarts) {
        await invalidateCartCache({
          userId: c.userId,
          guestToken: c.guestToken,
        });
      }

      logger.info(
        "Recorded out-of-stock adjustment for product in active carts",
        { productId },
      );
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "inventory.adjusted",
      aggregateId: productId,
    });
  } catch (err) {
    logger.error(
      "Error handling inventory event in cart-service",
      err as Error,
      { productId },
    );
  }
};
