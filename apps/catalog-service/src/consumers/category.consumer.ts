import { categoryProjector } from "../read-model/category-projector.js";
import { logger } from "../observability/metrics.js";

export async function handleCategoryCreated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await categoryProjector.projectCategoryUpsert(target, "category.created");
  } catch (error) {
    logger.error("Error handling category.created in catalog-service", {
      error: String(error),
    });
  }
}

export async function handleCategoryUpdated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    await categoryProjector.projectCategoryUpsert(target, "category.updated");
  } catch (error) {
    logger.error("Error handling category.updated in catalog-service", {
      error: String(error),
    });
  }
}

export async function handleCategoryDeleted(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const id =
      typeof target === "object" && target !== null ? target.id : target;
    await categoryProjector.projectCategoryDelete({ id });
  } catch (error) {
    logger.error("Error handling category.deleted in catalog-service", {
      error: String(error),
    });
  }
}
