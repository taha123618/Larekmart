import type {
  CatalogBrand,
  CatalogCategory,
  CatalogProduct,
  CatalogProductVariant,
  CatalogCollection,
} from "@repo/catalog-db";
import type {
  CatalogBrandType,
  CatalogCategoryItemType,
  CatalogProductCardType,
  CatalogProductVariantType,
  CatalogCollectionType,
} from "@repo/types";

export function mapPrismaAvailability(
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK",
): "in_stock" | "low_stock" | "out_of_stock" {
  switch (status) {
    case "IN_STOCK":
      return "in_stock";
    case "LOW_STOCK":
      return "low_stock";
    case "OUT_OF_STOCK":
      return "out_of_stock";
    default:
      return "in_stock";
  }
}

export function toPrismaAvailability(
  status?: string,
): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (!status) return "IN_STOCK";
  const upper = status.toUpperCase();
  if (upper === "IN_STOCK" || upper === "LOW_STOCK" || upper === "OUT_OF_STOCK") {
    return upper as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  }
  return "IN_STOCK";
}

export function mapBrand(brand: CatalogBrand): CatalogBrandType {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    description: brand.description,
    isActive: brand.isActive,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

export function mapProductVariant(variant: CatalogProductVariant): CatalogProductVariantType {
  return {
    id: variant.id,
    productId: variant.productId,
    variantId: variant.variantId,
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    price: variant.price,
    inStock: variant.inStock,
  };
}

export function mapProductCard(
  product: CatalogProduct & {
    brand?: CatalogBrand | null;
    primaryCategory?: CatalogCategory | null;
    variants?: CatalogProductVariant[];
  },
): CatalogProductCardType {
  const badges: string[] = [];
  if (product.isNew) badges.push("New");
  if (product.isFeatured) badges.push("Featured");
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    badges.push("Sale");
  }

  return {
    id: product.id,
    productId: product.productId,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    thumbnailUrl: product.thumbnailUrl,
    images: (product.images as Record<string, string>) || {},
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    discountPercentage: product.discountPercentage,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availabilityStatus: mapPrismaAvailability(product.availabilityStatus),
    brand: product.brand ? mapBrand(product.brand) : null,
    primaryCategory: product.primaryCategory
      ? {
          id: product.primaryCategory.id,
          name: product.primaryCategory.name,
          slug: product.primaryCategory.slug,
        }
      : null,
    badges,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isActive: product.isActive,
    publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function mapCategoryItem(
  category: CatalogCategory & {
    _count?: { primaryProducts: number; products?: number };
    children?: CatalogCategory[];
  },
  children: CatalogCategoryItemType[] = [],
): CatalogCategoryItemType {
  const count = category._count?.primaryProducts ?? 0;
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    position: category.position,
    isActive: category.isActive,
    productCount: count,
    children,
  };
}

export function mapCollection(
  collection: CatalogCollection & {
    _count?: { collectionProducts: number };
    collectionProducts?: Array<{
      position: number;
      product: CatalogProduct & {
        brand?: CatalogBrand | null;
        primaryCategory?: CatalogCategory | null;
      };
    }>;
  },
): CatalogCollectionType {
  const products = collection.collectionProducts
    ? collection.collectionProducts
        .sort((a, b) => a.position - b.position)
        .map((cp) => mapProductCard(cp.product))
    : undefined;

  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    imageUrl: collection.imageUrl,
    status: collection.status.toLowerCase() as "active" | "draft" | "archived",
    sortOrder: collection.sortOrder,
    startAt: collection.startAt ? collection.startAt.toISOString() : null,
    endAt: collection.endAt ? collection.endAt.toISOString() : null,
    productCount: collection._count?.collectionProducts ?? (products ? products.length : 0),
    products,
  };
}
