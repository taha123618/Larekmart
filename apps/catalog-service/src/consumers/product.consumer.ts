import { productProjector } from "../read-model/product-projector.js";
import { logger } from "../observability/metrics.js";

export async function handleProductCreated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await productProjector.projectProductUpsert(target, "product.created");
  } catch (error) {
    logger.error("Error handling product.created in catalog-service", {
      error: String(error),
    });
  }
}

export async function handleProductUpdated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await productProjector.projectProductUpsert(target, "product.updated");
  } catch (error) {
    logger.error("Error handling product.updated in catalog-service", {
      error: String(error),
    });
  }
}

export async function handleProductDeleted(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const id =
      typeof target === "object" && target !== null ? target.id : target;
    await productProjector.projectProductDelete({ id });
  } catch (error) {
    logger.error("Error handling product.deleted in catalog-service", {
      error: String(error),
    });
  }
}

export async function handleRatingSummaryUpdated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const data = target.data || target;
    const productId = data.productId;
    const averageRating = Number(data.averageRating) || 0;
    const reviewCount = Number(data.reviewCount) || 0;

    if (productId) {
      await productProjector.projectRatingSummaryUpdate({
        productId,
        averageRating,
        reviewCount,
        eventId: target.eventId,
      });
    }
  } catch (error) {
    logger.error(
      "Error handling product.rating-summary.updated in catalog-service",
      {
        error: String(error),
      },
    );
  }
}

export async function handlePriceUpdated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const productId = target.productId || target.id;
    const newPrice = target.newPrice ?? target.basePrice ?? target.price;

    if (
      productId !== undefined &&
      typeof newPrice === "number" &&
      !isNaN(newPrice)
    ) {
      await productProjector.projectPriceUpdated({
        productId,
        price: newPrice,
        compareAtPrice: target.compareAtPrice,
      });
    }
  } catch (error) {
    logger.error("Error handling pricing.price.updated in catalog-service", {
      error: String(error),
    });
  }
}
