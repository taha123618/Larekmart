import { wishlistItemRepository } from "../../repositories/wishlist-item.repository.js";
import { publishRestockedAlert } from "../producers/wishlist.producer.js";
import { recordRestockAlert, logger } from "../../observability/metrics.js";

interface InventoryEventPayload {
  productId?: string;
  variantId?: string | null;
  availableQuantity?: number;
  inStock?: boolean;
  data?: {
    productId?: string;
    variantId?: string | null;
    availableQuantity?: number;
    inStock?: boolean;
  };
}

export async function handleInventoryChanged(
  rawPayload: unknown,
): Promise<void> {
  try {
    const payload = rawPayload as InventoryEventPayload;
    const productId = payload.productId || payload.data?.productId;
    const variantId = payload.variantId || payload.data?.variantId || null;
    const availableQuantity =
      payload.availableQuantity ?? payload.data?.availableQuantity ?? 0;
    const inStock =
      payload.inStock ?? payload.data?.inStock ?? availableQuantity > 0;

    if (!productId) return;

    // Find all wishlist items referencing this product
    const items = await wishlistItemRepository.findItemsWithProduct(
      productId,
      variantId,
    );

    for (const { item, userId } of items) {
      const wasOutOfStock = !item.inStock;
      const nowInStock = inStock;

      // Update inStock status
      await wishlistItemRepository.update(item.id, {
        inStock: nowInStock,
      });

      // Detect restock: was out of stock, now in stock
      if (wasOutOfStock && nowInStock && userId) {
        recordRestockAlert(productId);

        await publishRestockedAlert({
          userId,
          wishlistId: item.wishlistId,
          itemId: item.id,
          productId,
          variantId: item.variantId,
          availableQuantity,
          detectedAt: new Date().toISOString(),
        });

        logger.info(
          `[RestockAlert] Product ${productId} restocked (qty: ${availableQuantity}), alert published for user ${userId}`,
        );
      }
    }
  } catch (error) {
    logger.error(
      "Error processing inventory change event in wishlist-service:",
      { error },
    );
  }
}
