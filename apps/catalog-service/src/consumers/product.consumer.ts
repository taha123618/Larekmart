import { productProjector } from "../read-model/product-projector.js";
import { logger } from "../observability/metrics.js";

export async function handleProductCreated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await productProjector.projectProductUpsert(target, "product.created");
  } catch (error) {
    logger.error("Error handling product.created in catalog-service", { error: String(error) });
  }
}

export async function handleProductUpdated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await productProjector.projectProductUpsert(target, "product.updated");
  } catch (error) {
    logger.error("Error handling product.updated in catalog-service", { error: String(error) });
  }
}

export async function handleProductDeleted(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const id = typeof target === "object" && target !== null ? target.id : target;
    await productProjector.projectProductDelete({ id });
  } catch (error) {
    logger.error("Error handling product.deleted in catalog-service", { error: String(error) });
  }
}
