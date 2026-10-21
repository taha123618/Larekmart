import type { Product } from "@repo/product-db";
import type { ProductCreatedPayload } from "@repo/types";

/**
 * Maps a catalog product to the Kafka payload search-service indexes.
 *
 * Shared by `product.created` and the OpenSearch backfill so a freshly created
 * product and a replayed one produce identical search documents (images,
 * sizes, colors, category). Keeping one mapper means the two paths can't drift.
 */
export function toProductEventPayload(product: Product): ProductCreatedPayload {
  return {
    id: String(product.id),
    name: product.name,
    price: product.price,
    shortDescription: product.shortDescription,
    description: product.description,
    categorySlug: product.categorySlug,
    sizes: product.sizes,
    colors: product.colors,
    images: product.images as unknown as Record<string, string>,
    sellerId: (product as Record<string, unknown>).sellerId as string | undefined,
    sellerName: (product as Record<string, unknown>).sellerName as string | undefined,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
