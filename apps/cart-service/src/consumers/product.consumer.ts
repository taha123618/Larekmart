import { Cart, ProcessedEvent } from "@repo/cart-db";
import { logger } from "../observability/metrics.js";
import { invalidateCartCache } from "../cache/cart-cache.js";

interface ProductEventPayload {
  id?: string;
  productId?: string;
  price?: number;
  name?: string;
  [key: string]: unknown;
}

export const handleProductUpdated = async (
  payload: ProductEventPayload,
): Promise<void> => {
  const targetId = payload.id || payload.productId;
  if (!targetId) return;

  const eventId = `prod_upd_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    if (typeof payload.price === "number") {
      const affectedCarts = await Cart.find(
        { status: "active", "items.productId": targetId },
        { userId: 1, guestToken: 1 },
      );

      // Refresh unit price across active carts for this product
      const updatedResult = await Cart.updateMany(
        { status: "active", "items.productId": targetId },
        {
          $set: {
            "items.$[elem].unitPrice": payload.price,
            "items.$[elem].subtotal": {
              $multiply: ["$items.$[elem].quantity", payload.price],
            },
          },
        },
        { arrayFilters: [{ "elem.productId": targetId }] },
      );

      for (const c of affectedCarts) {
        await invalidateCartCache({
          userId: c.userId,
          guestToken: c.guestToken,
        });
      }

      logger.info("Updated active cart item prices from product event", {
        targetId,
        modifiedCount: updatedResult.modifiedCount,
      });
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "product.updated",
      aggregateId: targetId,
    });
  } catch (err) {
    logger.error(
      "Error processing product.updated event in cart-service",
      err as Error,
      { targetId },
    );
  }
};

export const handleProductDeleted = async (
  payload: ProductEventPayload,
): Promise<void> => {
  const targetId = payload.id || payload.productId;
  if (!targetId) return;

  const eventId = `prod_del_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    const affectedCarts = await Cart.find(
      { status: "active", "items.productId": targetId },
      { userId: 1, guestToken: 1 },
    );

    // Flag or pull deleted item from active carts
    await Cart.updateMany(
      { status: "active", "items.productId": targetId },
      {
        $pull: { items: { productId: targetId } },
        $push: {
          adjustments: {
            itemId: targetId,
            productId: targetId,
            reason: "Product was discontinued or removed from catalog",
            oldQuantity: 1,
            newQuantity: 0,
            createdAt: new Date(),
          },
        },
      },
    );

    for (const c of affectedCarts) {
      await invalidateCartCache({ userId: c.userId, guestToken: c.guestToken });
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "product.deleted",
      aggregateId: targetId,
    });
    logger.info("Removed deleted product from active carts", { targetId });
  } catch (err) {
    logger.error(
      "Error processing product.deleted event in cart-service",
      err as Error,
      { targetId },
    );
  }
};
