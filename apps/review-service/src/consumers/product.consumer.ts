import { reviewRepository } from "../repositories/review.repository.js";
import { reviewCache } from "../cache/review-cache.js";

export async function handleProductDeleted(payload: any): Promise<void> {
  try {
    const data = payload?.data || payload;
    const productId = data?.productId || data?.id;

    if (!productId) {
      console.warn(
        "[ProductConsumer] Missing productId in product.deleted event",
      );
      return;
    }

    console.log(
      `[ProductConsumer] Handling product.deleted for product ${productId}`,
    );
    await reviewRepository.archiveProductReviews(String(productId));
    await reviewCache.invalidateSummary(String(productId));
  } catch (error) {
    console.error(
      "[ProductConsumer] Error handling product.deleted event:",
      error,
    );
  }
}
