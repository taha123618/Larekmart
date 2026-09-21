import { prisma } from "@repo/catalog-db";
import { invalidateCategoryCache } from "../cache/catalog-cache.js";
import { logger } from "../observability/metrics.js";

interface CategoryEventData {
  id: string | number;
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  position?: number;
  isActive?: boolean;
  eventId?: string;
}

export class CategoryProjector {
  private async isEventProcessed(eventId?: string): Promise<boolean> {
    if (!eventId) return false;
    const existing = await prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return !!existing;
  }

  private async markEventProcessed(eventId?: string, eventType = "category.projector") {
    if (!eventId) return;
    await prisma.processedEvent.create({
      data: {
        eventId,
        eventType,
      },
    }).catch(() => { });
  }

  async projectCategoryUpsert(data: CategoryEventData, eventType: string): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) {
      logger.info(`Skipping already processed category event: ${eventId}`);
      return;
    }

    const categoryId = String(data.id);
    const slug = data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `category-${categoryId}`;

    const upserted = await prisma.catalogCategory.upsert({
      where: { id: categoryId },
      create: {
        id: categoryId,
        name: data.name || "Category",
        slug,
        description: data.description || null,
        image: data.image || null,
        parentId: data.parentId || null,
        position: data.position ?? 0,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        slug: data.slug || (data.name ? slug : undefined),
        description: data.description,
        image: data.image,
        parentId: data.parentId,
        position: data.position,
        isActive: data.isActive,
      },
    });

    await this.markEventProcessed(eventId, eventType);
    await invalidateCategoryCache(upserted.id);
    logger.info(`Projected category upsert: ${categoryId} (${eventType})`);
  }

  async projectCategoryDelete(data: { id: string | number; eventId?: string }): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) return;

    const categoryId = String(data.id);
    await prisma.catalogCategory.updateMany({
      where: { id: categoryId },
      data: { isActive: false },
    });

    await this.markEventProcessed(eventId, "category.deleted");
    await invalidateCategoryCache(categoryId);
    logger.info(`Projected category deactivated/deleted: ${categoryId}`);
  }
}

export const categoryProjector = new CategoryProjector();
