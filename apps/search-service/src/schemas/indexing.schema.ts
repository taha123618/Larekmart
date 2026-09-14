import { z } from "zod";
import { ReindexRequestSchema } from "@repo/types";

export { ReindexRequestSchema };

export const ProductEventPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => v.toString()),
  name: z.string(),
  price: z.coerce.number(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  images: z.record(z.string(), z.string()).optional(),
  inStock: z.boolean().optional(),
  rating: z.number().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type ProductEventPayload = z.infer<typeof ProductEventPayloadSchema>;

/**
 * Body schema for `POST /api/v1/index/product` — admin upsert of a single
 * product document. Mirrors the Kafka event payload so the admin can push
 * corrections without waiting for an event round-trip.
 */
export const UpsertProductSchema = ProductEventPayloadSchema;
export type UpsertProductBody = z.infer<typeof UpsertProductSchema>;

/**
 * Body schema for `PATCH /api/v1/index/product/:id` — partial update of an
 * existing document via `doc_as_upsert`. All fields are optional.
 */
export const PartialUpdateProductSchema = z.object({
  name: z.string().optional(),
  price: z.coerce.number().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  images: z.record(z.string(), z.string()).optional(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  discountPercentage: z.number().optional(),
  tags: z.array(z.string()).optional(),
});
export type PartialUpdateProductBody = z.infer<
  typeof PartialUpdateProductSchema
>;

/**
 * Body schema for `POST /api/v1/index/bulk` — batch upsert of multiple product
 * documents. Delegates to bulkIndexProducts from @repo/opensearch under the hood.
 */
export const BulkIndexRequestSchema = z.object({
  products: z.array(UpsertProductSchema).min(1).max(1000),
  /** Documents per bulk API call (default 250). */
  batchSize: z.number().int().min(1).max(1000).default(250),
});
export type BulkIndexBody = z.infer<typeof BulkIndexRequestSchema>;
