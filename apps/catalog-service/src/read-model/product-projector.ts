import { prisma } from "@repo/catalog-db";
import { invalidateProductCache } from "../cache/catalog-cache.js";
import { logger } from "../observability/metrics.js";

interface ProductEventData {
  id: string | number;
  name?: string;
  slug?: string;
  price?: number;
  compareAtPrice?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  categorySlug?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  images?: Record<string, string> | null;
  sizes?: string[];
  colors?: string[];
  isFeatured?: boolean;
  isNew?: boolean;
  isActive?: boolean;
  rating?: number;
  reviewCount?: number;
  availabilityStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  eventId?: string;
}

export class ProductProjector {
  private async isEventProcessed(eventId?: string): Promise<boolean> {
    if (!eventId) return false;
    const existing = await prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return !!existing;
  }

  private async markEventProcessed(
    eventId?: string,
    eventType = "product.projector",
  ) {
    if (!eventId) return;
    await prisma.processedEvent
      .create({
        data: {
          eventId,
          eventType,
        },
      })
      .catch(() => {
        // Ignore unique constraint collision
      });
  }

  async projectProductUpsert(
    data: ProductEventData,
    eventType: string,
  ): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) {
      logger.info(`Skipping already processed event: ${eventId}`);
      return;
    }

    const productId = String(data.id);
    const slug =
      data.slug ||
      data.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") ||
      `product-${productId}`;
    const price = typeof data.price === "number" ? data.price : 0;
    const compareAtPrice =
      typeof data.compareAtPrice === "number" ? data.compareAtPrice : null;
    const discountPercentage =
      compareAtPrice && compareAtPrice > price
        ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
        : 0;

    let thumbnailUrl =
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30";
    if (data.images && typeof data.images === "object") {
      const firstImg = Object.values(data.images)[0];
      if (typeof firstImg === "string" && firstImg.length > 0) {
        thumbnailUrl = firstImg;
      }
    }

    // Resolve category if categorySlug or categoryId is given
    let primaryCategoryId: string | null = null;
    if (data.categoryId) {
      const cat = await prisma.catalogCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (cat) primaryCategoryId = cat.id;
    } else if (data.categorySlug) {
      const cat = await prisma.catalogCategory.findUnique({
        where: { slug: data.categorySlug },
      });
      if (cat) primaryCategoryId = cat.id;
    }

    const upserted = await prisma.catalogProduct.upsert({
      where: { productId },
      create: {
        productId,
        name: data.name || "Untitled Product",
        slug,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
        brandId: data.brandId || null,
        primaryCategoryId,
        thumbnailUrl,
        images: (data.images as any) || {},
        price,
        compareAtPrice,
        discountPercentage,
        rating: data.rating ?? 0,
        reviewCount: data.reviewCount ?? 0,
        availabilityStatus: data.availabilityStatus || "IN_STOCK",
        isFeatured: data.isFeatured ?? false,
        isNew: data.isNew ?? true,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        slug: data.slug || (data.name ? slug : undefined),
        shortDescription: data.shortDescription,
        description: data.description,
        brandId: data.brandId,
        primaryCategoryId: primaryCategoryId || undefined,
        thumbnailUrl: data.images ? thumbnailUrl : undefined,
        images: (data.images as any) || undefined,
        price: data.price !== undefined ? price : undefined,
        compareAtPrice:
          data.compareAtPrice !== undefined ? compareAtPrice : undefined,
        discountPercentage,
        rating: data.rating,
        reviewCount: data.reviewCount,
        availabilityStatus: data.availabilityStatus,
        isFeatured: data.isFeatured,
        isNew: data.isNew,
        isActive: data.isActive,
      },
    });

    // Create variants if sizes/colors are provided
    if (
      (data.sizes && data.sizes.length > 0) ||
      (data.colors && data.colors.length > 0)
    ) {
      const sizes =
        data.sizes && data.sizes.length > 0 ? data.sizes : ["Standard"];
      const colors =
        data.colors && data.colors.length > 0 ? data.colors : ["Default"];

      for (const size of sizes) {
        for (const color of colors) {
          const variantId = `${productId}-${size}-${color}`
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-");
          await prisma.catalogProductVariant
            .upsert({
              where: {
                productId_variantId: {
                  productId,
                  variantId,
                },
              },
              create: {
                productId,
                variantId,
                size,
                color,
                price,
                inStock: true,
              },
              update: {
                price,
                size,
                color,
              },
            })
            .catch((err) => {
              logger.warn(`Failed to upsert variant ${variantId}:`, {
                error: String(err),
              });
            });
        }
      }
    }

    // Link secondary category if resolved
    if (primaryCategoryId) {
      await prisma.catalogCategoryProduct
        .upsert({
          where: {
            categoryId_productId: {
              categoryId: primaryCategoryId,
              productId,
            },
          },
          create: {
            categoryId: primaryCategoryId,
            productId,
          },
          update: {},
        })
        .catch(() => {});
    }

    await this.markEventProcessed(eventId, eventType);
    await invalidateProductCache(
      productId,
      upserted.primaryCategoryId,
      upserted.brandId,
    );
    logger.info(`Projected product upsert: ${productId} (${eventType})`);
  }

  async projectProductDelete(data: {
    id: string | number;
    eventId?: string;
  }): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) {
      logger.info(`Skipping already processed event: ${eventId}`);
      return;
    }

    const productId = String(data.id);
    const existing = await prisma.catalogProduct.findUnique({
      where: { productId },
    });

    if (existing) {
      await prisma.catalogProduct.update({
        where: { productId },
        data: { isActive: false },
      });
      await invalidateProductCache(
        productId,
        existing.primaryCategoryId,
        existing.brandId,
      );
      logger.info(`Projected product deactivated/deleted: ${productId}`);
    }

    await this.markEventProcessed(eventId, "product.deleted");
  }

  async projectInventoryUpdate(data: {
    productId: string;
    available?: number;
    status?: string;
    eventId?: string;
  }): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) return;

    let availabilityStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" =
      "IN_STOCK";
    if (data.status) {
      const upper = data.status.toUpperCase();
      if (upper.includes("OUT") || data.available === 0) {
        availabilityStatus = "OUT_OF_STOCK";
      } else if (
        upper.includes("LOW") ||
        (data.available !== undefined && data.available <= 5)
      ) {
        availabilityStatus = "LOW_STOCK";
      }
    } else if (data.available !== undefined) {
      if (data.available === 0) availabilityStatus = "OUT_OF_STOCK";
      else if (data.available <= 5) availabilityStatus = "LOW_STOCK";
      else availabilityStatus = "IN_STOCK";
    }

    const updated = await prisma.catalogProduct.updateMany({
      where: { productId: data.productId },
      data: { availabilityStatus },
    });

    if (updated.count > 0) {
      await invalidateProductCache(data.productId);
      logger.info(
        `Projected inventory status update for product ${data.productId}: ${availabilityStatus}`,
      );
    }

    await this.markEventProcessed(eventId, "inventory.adjusted");
  }

  async projectRatingSummaryUpdate(data: {
    productId: string | number;
    averageRating: number;
    reviewCount: number;
    eventId?: string;
  }): Promise<void> {
    const eventId = data.eventId;
    if (await this.isEventProcessed(eventId)) return;

    const productId = String(data.productId);
    const updated = await prisma.catalogProduct.updateMany({
      where: { productId },
      data: {
        rating: data.averageRating,
        reviewCount: data.reviewCount,
      },
    });

    if (updated.count > 0) {
      await invalidateProductCache(productId);
      logger.info(
        `Projected rating summary update for product ${productId}: rating=${data.averageRating}, reviews=${data.reviewCount}`,
      );
    }

    await this.markEventProcessed(eventId, "product.rating-summary.updated");
  }
}

export const productProjector = new ProductProjector();
