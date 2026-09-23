import { productProjector } from "../read-model/product-projector.js";
import { logger } from "../observability/metrics.js";

export async function handleInventoryAdjusted(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const productId = target.productId || target.id;
    if (!productId) return;

    await productProjector.projectInventoryUpdate({
      productId: String(productId),
      available: target.available ?? target.quantity,
      status: target.status,
      eventId: target.eventId,
    });
  } catch (error) {
    logger.error("Error handling inventory update in catalog-service", {
      error: String(error),
    });
  }
}
