import { z } from "zod";

// ==========================================
// Catalog Read Model Schemas & Types
// ==========================================

export const CatalogBrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type CatalogBrandType = z.infer<typeof CatalogBrandSchema>;

export const CatalogCategoryItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable().optional(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
  productCount: z.number().int().default(0),
  children: z
    .array(z.lazy((): z.ZodTypeAny => CatalogCategoryItemSchema))
    .default([]),
});
export type CatalogCategoryItemType = z.infer<typeof CatalogCategoryItemSchema>;

export const CatalogProductVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string(),
  size: z.string().default(""),
  color: z.string().default(""),
  sku: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  inStock: z.boolean().default(true),
});
export type CatalogProductVariantType = z.infer<
  typeof CatalogProductVariantSchema
>;

export const CatalogProductCardSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string().nullable().optional(),
  thumbnailUrl: z.string(),
  images: z.record(z.string(), z.string()).optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  discountPercentage: z.number().nonnegative().default(0),
  rating: z.number().default(0),
  reviewCount: z.number().int().default(0),
  availabilityStatus: z
    .enum(["in_stock", "low_stock", "out_of_stock"])
    .default("in_stock"),
  brand: CatalogBrandSchema.nullable().optional(),
  primaryCategory: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable()
    .optional(),
  badges: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isActive: z.boolean().default(true),
  publishedAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});
export type CatalogProductCardType = z.infer<typeof CatalogProductCardSchema>;

export const CatalogCollectionProductSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  productId: z.string(),
  position: z.number().int().default(0),
  product: CatalogProductCardSchema.optional(),
});
export type CatalogCollectionProductType = z.infer<
  typeof CatalogCollectionProductSchema
>;

export const CatalogCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  sortOrder: z.number().int().default(0),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  productCount: z.number().int().default(0),
  products: z.array(CatalogProductCardSchema).optional(),
});
export type CatalogCollectionType = z.infer<typeof CatalogCollectionSchema>;

export const CatalogProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  sort: z
    .enum([
      "newest",
      "price_asc",
      "price_desc",
      "rating",
      "featured",
      "popular",
    ])
    .default("newest"),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  availability: z
    .enum(["in_stock", "low_stock", "out_of_stock", "all"])
    .default("all"),
  isFeatured: z.coerce.boolean().optional(),
  isNew: z.coerce.boolean().optional(),
});
export type CatalogProductQueryType = z.infer<typeof CatalogProductQuerySchema>;

export const CatalogPaginatedResponseSchema = z.object({
  data: z.array(CatalogProductCardSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});
export type CatalogPaginatedResponseType = z.infer<
  typeof CatalogPaginatedResponseSchema
>;
