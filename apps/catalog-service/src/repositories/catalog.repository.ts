import type { Prisma } from "@repo/catalog-db";
import type {
  CatalogProductQueryType,
  CatalogPaginatedResponseType,
} from "@repo/types";
import { mapProductCard } from "../utils/mappers.js";
import { getDatabaseClient } from "../utils/database-context.js";

const productInclude = {
  brand: true,
  primaryCategory: true,
  variants: true,
} as const;

export class CatalogRepository {
  async findProducts(
    query: CatalogProductQueryType,
    forcePrimary?: boolean,
  ): Promise<CatalogPaginatedResponseType> {
    const {
      page = 1,
      limit = 24,
      sort = "newest",
      category,
      brand,
      minPrice,
      maxPrice,
      availability,
      isFeatured,
      isNew,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CatalogProductWhereInput = {
      isActive: true,
    };

    if (category) {
      where.OR = [
        { primaryCategory: { slug: category } },
        { primaryCategoryId: category },
        { categoryProducts: { some: { category: { slug: category } } } },
        { categoryProducts: { some: { categoryId: category } } },
      ];
    }

    if (brand) {
      where.brand = {
        OR: [{ slug: brand }, { id: brand }],
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (availability && availability !== "all") {
      switch (availability) {
        case "in_stock":
          where.availabilityStatus = "IN_STOCK";
          break;
        case "low_stock":
          where.availabilityStatus = "LOW_STOCK";
          break;
        case "out_of_stock":
          where.availabilityStatus = "OUT_OF_STOCK";
          break;
      }
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (isNew !== undefined) {
      where.isNew = isNew;
    }

    let orderBy: Prisma.CatalogProductOrderByWithRelationInput = {
      publishedAt: "desc",
    };
    switch (sort) {
      case "newest":
        orderBy = { publishedAt: "desc" };
        break;
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "rating":
        orderBy = { rating: "desc" };
        break;
      case "popular":
        orderBy = { reviewCount: "desc" };
        break;
      case "featured":
        orderBy = { isFeatured: "desc" };
        break;
    }

    const db = getDatabaseClient(forcePrimary);
    const [total, products] = await Promise.all([
      db.catalogProduct.count({ where }),
      db.catalogProduct.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: productInclude,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products.map(mapProductCard),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findProductById(productIdOrId: string, forcePrimary?: boolean) {
    const db = getDatabaseClient(forcePrimary);
    const product = await db.catalogProduct.findFirst({
      where: {
        OR: [{ productId: productIdOrId }, { id: productIdOrId }],
        isActive: true,
      },
      include: productInclude,
    });
    return product ? mapProductCard(product) : null;
  }

  async findProductBySlug(slug: string, forcePrimary?: boolean) {
    const db = getDatabaseClient(forcePrimary);
    const product = await db.catalogProduct.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: productInclude,
    });
    return product ? mapProductCard(product) : null;
  }

  async findFeaturedProducts(limit = 12, forcePrimary?: boolean) {
    const db = getDatabaseClient(forcePrimary);
    const products = await db.catalogProduct.findMany({
      where: {
        isFeatured: true,
        isActive: true,
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: productInclude,
    });
    return products.map(mapProductCard);
  }

  async findNewArrivals(limit = 12, forcePrimary?: boolean) {
    const db = getDatabaseClient(forcePrimary);
    const products = await db.catalogProduct.findMany({
      where: {
        isNew: true,
        isActive: true,
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: productInclude,
    });
    return products.map(mapProductCard);
  }

  async findBestSellers(limit = 12, forcePrimary?: boolean) {
    const db = getDatabaseClient(forcePrimary);
    const products = await db.catalogProduct.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
      take: limit,
      include: productInclude,
    });
    return products.map(mapProductCard);
  }

  async findProductsByCategory(
    categoryIdOrSlug: string,
    page = 1,
    limit = 24,
    sort = "newest",
    forcePrimary?: boolean,
  ): Promise<CatalogPaginatedResponseType> {
    return this.findProducts(
      {
        category: categoryIdOrSlug,
        page,
        limit,
        sort: sort as any,
        availability: "all",
      },
      forcePrimary,
    );
  }
}

export const catalogRepository = new CatalogRepository();
