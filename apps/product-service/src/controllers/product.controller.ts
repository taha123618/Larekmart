import { Request, Response } from "express";
import { prisma, Prisma } from "@repo/product-db";
import { ProductFormSchema } from "@repo/types";
import { publishEvent } from "../utils/kafka";
import { toProductEventPayload } from "../search/product-payload.js";
import { createLogger, measureAsync } from "@repo/monitoring";
import {
  getCachedProduct,
  getCachedProducts,
  setCachedProduct,
  setCachedProducts,
  invalidateCatalogCache,
} from "../cache/catalog-cache.js";

const logger = createLogger("product-service:controller");

export const createProduct = async (req: Request, res: Response) => {
  const parsed = ProductFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { categorySlug, ...rest } = parsed.data;
  const data: Prisma.ProductCreateInput = {
    ...rest,
    category: {
      connect: { slug: categorySlug },
    },
  };

  const { result: product } = await measureAsync(
    "db.product.create",
    async () => {
      return await prisma.product.create({ data });
    },
  );

  logger.info(`Product created successfully with ID: ${product.id}`);

  // Publish the full product (a superset of StripeProductType) so
  // search-service can index images, sizes, and colors immediately instead of
  // waiting for a follow-up update event. payment-service still finds the
  // id/name/price it needs to mirror the catalog into Stripe. The same mapper
  // drives the search backfill (`backfill:search`).
  publishEvent("product.created", toProductEventPayload(product));
  await invalidateCatalogCache();
  res.status(201).json(product);
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  const data: Prisma.ProductUpdateInput = req.body;

  const { result: updatedProduct } = await measureAsync(
    "db.product.update",
    async () => {
      return await prisma.product.update({
        where: { id: productId },
        data,
      });
    },
  );

  logger.info(`Product updated successfully with ID: ${productId}`);
  publishEvent("product.updated", updatedProduct);
  await invalidateCatalogCache();
  return res.status(200).json(updatedProduct);
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  const { result: deletedProduct } = await measureAsync(
    "db.product.delete",
    async () => {
      return await prisma.product.delete({
        where: { id: productId },
      });
    },
  );

  logger.info(`Product deleted with ID: ${productId}`);
  publishEvent("product.deleted", productId);
  await invalidateCatalogCache();

  return res.status(200).json(deletedProduct);
};

export const getProducts = async (req: Request, res: Response) => {
  const { sort, category, search, limit, ids } = req.query;

  const query = {
    ids: typeof ids === "string" ? ids : undefined,
    sort: typeof sort === "string" ? sort : undefined,
    category: typeof category === "string" ? category : undefined,
    search: typeof search === "string" ? search : undefined,
    limit: typeof limit === "string" ? limit : undefined,
  };

  const cached = await getCachedProducts(query);
  if (cached) return res.status(200).json(cached);

  const orderBy = (() => {
    switch (sort) {
      case "asc":
        return { price: Prisma.SortOrder.asc };
      case "desc":
        return { price: Prisma.SortOrder.desc };
      case "oldest":
        return { createdAt: Prisma.SortOrder.asc };
      default:
        return { createdAt: Prisma.SortOrder.desc };
    }
  })();

  const { result: products } = await measureAsync(
    "db.product.findMany",
    async () => {
      return await prisma.product.findMany({
        where: {
          id: ids ? { in: (ids as string).split(",").map(Number).filter(n => !isNaN(n)) } : undefined,
          category: category ? {
            slug: category as string,
          } : undefined,
          name: search ? {
            contains: search as string,
            mode: "insensitive",
          } : undefined,
        },
        orderBy,
        take: limit ? Number(limit) : undefined,
      });
    },
  );

  await setCachedProducts(query, products);
  res.status(200).json(products);
};

export const getProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  const cached = await getCachedProduct(productId);
  if (cached) return res.status(200).json(cached);

  const { result: product } = await measureAsync(
    "db.product.findUnique",
    async () => {
      return await prisma.product.findUnique({
        where: { id: productId },
      });
    },
  );

  // A null here means "no such product", not "not cached yet", so caching it
  // would only delay a subsequent real result.
  if (product) {
    await setCachedProduct(productId, product);
  }

  return res.status(200).json(product);
};
