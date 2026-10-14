import { wishlistItemRepository } from "../../repositories/wishlist-item.repository.js";
import { publishPriceDropAlert } from "../producers/wishlist.producer.js";
import { recordPriceDropAlert, logger } from "../../observability/metrics.js";

interface PriceUpdatedPayload {
  productId?: string;
  variantId?: string | null;
  price?: number;
  newPrice?: number;
  oldPrice?: number;
  data?: {
    productId?: string;
    variantId?: string | null;
    price?: number;
    newPrice?: number;
  };
}

interface ProductDeletedPayload {
  productId?: string;
  data?: { productId?: string };
}

export async function handlePriceUpdated(rawPayload: unknown): Promise<void> {
  try {
    const payload = rawPayload as PriceUpdatedPayload;
    const productId = payload.productId || payload.data?.productId;
    const variantId = payload.variantId || payload.data?.variantId || null;
    const rawPrice =
      payload.newPrice ??
      payload.price ??
      payload.data?.newPrice ??
      payload.data?.price;

    if (!productId || rawPrice === undefined) {
      return;
    }

    const newPrice = Number(rawPrice);
    if (isNaN(newPrice) || newPrice < 0) return;

    // 1. Locate all wishlist items for this product
    const items = await wishlistItemRepository.findItemsWithProduct(
      productId,
      variantId,
    );

    for (const { item, userId } of items) {
      const baselinePrice = item.currentPrice ?? item.addedPrice;

      if (newPrice < baselinePrice && baselinePrice > 0) {
        const dropPercentage = Math.round(
          ((baselinePrice - newPrice) / baselinePrice) * 100,
        );

        // Update item's current price in DB
        await wishlistItemRepository.update(item.id, {
          currentPrice: newPrice,
        });

        recordPriceDropAlert(productId);

        if (userId) {
          await publishPriceDropAlert({
            userId,
            wishlistId: item.wishlistId,
            itemId: item.id,
            productId,
            variantId: item.variantId,
            oldPrice: baselinePrice,
            newPrice,
            dropPercentage,
            detectedAt: new Date().toISOString(),
          });
        }

        logger.info(
          `[PriceDrop] Detected price drop for product ${productId} from ${baselinePrice} to ${newPrice} (-${dropPercentage}%)`,
        );
      } else {
        // Just update current price
        await wishlistItemRepository.update(item.id, {
          currentPrice: newPrice,
        });
      }
    }
  } catch (error) {
    logger.error("Error processing price.updated event in wishlist-service:", {
      error,
    });
  }
}

export async function handleProductDeleted(rawPayload: unknown): Promise<void> {
  try {
    const payload = rawPayload as ProductDeletedPayload;
    const productId = payload.productId || payload.data?.productId;
    if (!productId) return;

    logger.info(
      `[ProductDeleted] Product ${productId} deleted; updating wishlist availability`,
    );
    await wishlistItemRepository.updateStockStatus(productId, null, false);
  } catch (error) {
    logger.error(
      "Error processing product.deleted event in wishlist-service:",
      { error },
    );
  }
}
