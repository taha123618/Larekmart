import { prisma } from "@repo/catalog-db";
import { invalidateCollectionCache } from "../cache/catalog-cache.js";
import { logger } from "../observability/metrics.js";

interface CollectionEventData {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  sortOrder?: number;
  productPositions?: Array<{ productId: string; position: number }>;
  eventId?: string;
}

export class CollectionProjector {
  private async isEventProcessed(eventId?: string): Promise<boolean> {
    if (!eventId) return false;
    const existing = await prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return !!existing;
  }

  private async markEventProcessed(
    eventId?: string,
    eventType = "collection.projector",
  ) {
    if (!eventId) return;
    await prisma.processedEvent
      .create({
        data: {
          eventId,
          eventType,
        },
      })
      .catch(() => {});
  }

  async projectCollectionUpsert(
    data: CollectionEventData,
    eventType: string,
  ): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) {
      logger.info(`Skipping already processed collection event: ${eventId}`);
      return;
    }

    const slug =
      data.slug ||
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const collection = await prisma.catalogCollection.upsert({
      where: { slug },
      create: {
        name: data.name,
        slug,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        status: data.status || "ACTIVE",
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        status: data.status,
        sortOrder: data.sortOrder,
      },
    });

    if (data.productPositions && data.productPositions.length > 0) {
      for (const item of data.productPositions) {
        // Ensure product exists before linking
        const productExists = await prisma.catalogProduct.findUnique({
          where: { productId: item.productId },
        });

        if (productExists) {
          await prisma.catalogCollectionProduct
            .upsert({
              where: {
                collectionId_productId: {
                  collectionId: collection.id,
                  productId: item.productId,
                },
              },
              create: {
                collectionId: collection.id,
                productId: item.productId,
                position: item.position,
              },
              update: {
                position: item.position,
              },
            })
            .catch(() => {});
        }
      }
    }

    await this.markEventProcessed(eventId, eventType);
    await invalidateCollectionCache(slug);
    logger.info(`Projected collection upsert: ${slug} (${eventType})`);
  }
}

export const collectionProjector = new CollectionProjector();
