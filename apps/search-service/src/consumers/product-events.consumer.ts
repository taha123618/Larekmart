import { indexingService } from "../services/indexing.service.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import { ProductEventPayloadSchema } from "../schemas/indexing.schema.js";
import type { SearchProductDocument } from "@repo/types";

export function transformProductEventToDocument(
  raw: any,
): SearchProductDocument {
  const id = String(raw.id);
  const name = String(raw.name || "");
  const price = Number(raw.price || 0);

  return {
    id,
    sku: raw.sku || `SKU-${id}`,
    slug: raw.slug || name.toLowerCase().replace(/\s+/g, "-"),
    name,
    shortDescription: raw.shortDescription || name,
    description: raw.description || name,
    brand: raw.brand || "Larekmart",
    category:
      raw.category?.name || raw.category || raw.categorySlug || "Clothing",
    categorySlug: raw.categorySlug || raw.category?.slug || "clothing",
    category_id: raw.category_id || raw.category?.id || 1,
    subcategories: Array.isArray(raw.subcategories) ? raw.subcategories : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    attributes: typeof raw.attributes === "object" ? raw.attributes : {},
    price,
    compareAtPrice: raw.compareAtPrice,
    discountPercentage: raw.discountPercentage || 0,
    currency: raw.currency || "USD",
    sizes: Array.isArray(raw.sizes) ? raw.sizes : ["m", "l"],
    colors: Array.isArray(raw.colors) ? raw.colors : ["black"],
    images:
      typeof raw.images === "object" && raw.images !== null ? raw.images : {},
    inStock: raw.inStock !== undefined ? Boolean(raw.inStock) : true,
    stockQuantity: raw.stockQuantity ?? 100,
    rating: raw.rating ?? 4.5,
    reviewCount: raw.reviewCount ?? 0,
    sellerId: raw.sellerId || "admin",
    sellerName: raw.sellerName || "Larekmart Official",
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    isFeatured: raw.isFeatured !== undefined ? Boolean(raw.isFeatured) : false,
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: raw.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function registerProductEventSubscriptions(
  consumer: any,
): Promise<void> {
  const topics = [
    {
      topicName: config.kafka.topics.productCreated,
      topicHandler: async (message: any) => {
        const payload = message.value || message;
        logger.info("Received product.created event", { payload });

        try {
          const validated = ProductEventPayloadSchema.parse(payload);
          const doc = transformProductEventToDocument(validated);
          await indexingService.indexOrUpdateProduct(doc);
          searchMetrics.kafkaEventsProcessedTotal.inc({
            topic: config.kafka.topics.productCreated,
            status: "success",
          });
        } catch (error: any) {
          searchMetrics.kafkaEventsProcessedTotal.inc({
            topic: config.kafka.topics.productCreated,
            status: "error",
          });
          logger.error("Failed to process product.created event", {
            error: error.message,
            payload,
          });
        }
      },
    },
    {
      topicName: config.kafka.topics.productUpdated,
      topicHandler: async (message: any) => {
        const payload = message.value || message;
        logger.info("Received product.updated event", { payload });

        try {
          const validated = ProductEventPayloadSchema.parse(payload);
          const doc = transformProductEventToDocument(validated);
          await indexingService.indexOrUpdateProduct(doc);
          searchMetrics.kafkaEventsProcessedTotal.inc({
            topic: config.kafka.topics.productUpdated,
            status: "success",
          });
        } catch (error: any) {
          searchMetrics.kafkaEventsProcessedTotal.inc({
            topic: config.kafka.topics.productUpdated,
            status: "error",
          });
          logger.error("Failed to process product.updated event", {
            error: error.message,
            payload,
          });
        }
      },
    },
    {
      topicName: config.kafka.topics.productDeleted,
      topicHandler: async (message: any) => {
        const payload = message.value || message;
        logger.info("Received product.deleted event", { payload });

        try {
          const productId = typeof payload === "object" ? payload.id : payload;
          if (productId !== undefined && productId !== null) {
            await indexingService.deleteProduct(productId);
            searchMetrics.kafkaEventsProcessedTotal.inc({
              topic: config.kafka.topics.productDeleted,
              status: "success",
            });
          }
        } catch (error: any) {
          searchMetrics.kafkaEventsProcessedTotal.inc({
            topic: config.kafka.topics.productDeleted,
            status: "error",
          });
          logger.error("Failed to process product.deleted event", {
            error: error.message,
            payload,
          });
        }
      },
    },
  ];

  try {
    await consumer.subscribe(topics);
    logger.info("Subscribed to product event topics successfully");
  } catch (error) {
    logger.warn(
      "Kafka subscription registration failed (Kafka might be offline)",
      { error },
    );
  }
}
