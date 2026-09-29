import type { Product, Category } from "@repo/product-db";
import z from "zod";

export type ProductType = Product;

export type ProductsType = ProductType[];

export type StripeProductType = {
  id: string;
  name: string;
  price: number;
};

/**
 * `product.created` Kafka payload.
 *
 * A superset of `StripeProductType` (payment-service reads `id`/`name`/`price`
 * to mirror the catalog into Stripe) that also carries the catalog fields
 * search-service indexes — so a freshly created product is searchable with
 * images, sizes, and colors without waiting for a follow-up `product.updated`.
 */
export type ProductCreatedPayload = {
  id: string;
  name: string;
  price: number;
  shortDescription: string;
  description: string;
  categorySlug: string;
  sizes: string[];
  colors: string[];
  images: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

/**
 * Product image references.
 *
 * Since media-service owns all media, the `images` JSON stores **media
 * references** keyed by color — `"media:<uuid>"` — instead of storage URLs.
 * Frontends resolve references dynamically via media-service
 * (`POST /api/v1/media/resolve`), so URL expiration, provider changes, and
 * credential rotation never require rewriting product rows.
 *
 * Legacy products may still hold raw URLs (Cloudinary or local paths);
 * resolvers pass those through untouched, so both shapes render side by
 * side during migration.
 */
export type ProductImageRefs = Record<string, string>;

/**
 * `category.created` and `category.updated` Kafka payloads.
 *
 * `product-service` owns categories and publishes the authoritative row;
 * `catalog-service` projects it into the denormalized `CatalogCategory` read
 * model, keyed by the same id so `?category=<id>` filters and category pages
 * line up with the source of truth.
 *
 * Only id/name/slug are sent today because that is all the `Category` model
 * stores; the catalog projector defaults the remaining read-model fields
 * (description, image, parentId, position, isActive).
 */
export type CategoryEventPayload = {
  id: number;
  name: string;
  slug: string;
};

/**
 * `category.deleted` Kafka payload: the bare category id, matching
 * `product.deleted`. Consumers only need the identifier to deactivate the
 * projected row.
 */
export type CategoryDeletedPayload = number;

export const colors = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
] as const;

export const sizes = [
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
] as const;

export const ProductFormSchema = z
  .object({
    name: z
      .string({ message: "Product name is required!" })
      .min(1, { message: "Product name is required!" }),
    shortDescription: z
      .string({ message: "Short description is required!" })
      .min(1, { message: "Short description is required!" })
      .max(60),
    description: z
      .string({ message: "Description is required!" })
      .min(1, { message: "Description is required!" }),
    price: z
      .number({ message: "Price is required!" })
      .min(1, { message: "Price is required!" }),
    categorySlug: z
      .string({ message: "Category is required!" })
      .min(1, { message: "Category is required!" }),
    sizes: z
      .array(z.enum(sizes))
      .min(1, { message: "At least one size is required!" }),
    colors: z
      .array(z.enum(colors))
      .min(1, { message: "At least one color is required!" }),
    images: z.record(z.string(), z.string(), {
      message: "Image for each color is required!",
    }),
  })
  .refine(
    (data) => {
      const missingImages = data.colors.filter(
        (color: string) => !data.images?.[color],
      );
      return missingImages.length === 0;
    },
    {
      message: "Image is required for each selected color!",
      path: ["images"],
    },
  );

export type CategoryType = Category;

export const CategoryFormSchema = z.object({
  name: z
    .string({ message: "Name is Required!" })
    .min(1, { message: "Name is Required!" }),
  slug: z
    .string({ message: "Slug is Required!" })
    .min(1, { message: "Slug is Required!" }),
});
