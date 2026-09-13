import { Request, Response } from "express";
import { prisma, Prisma } from "@repo/product-db";
import { producer } from "../utils/kafka";
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
  const data: Prisma.ProductCreateInput = req.body;

  const { colors, images } = data;
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    return res.status(400).json({ message: "Colors array is required!" });
  }

  if (!images || typeof images !== "object") {
    return res.status(400).json({ message: "Images object is required!" });
  }

  const missingColors = colors.filter((color) => !(color in images));

  if (missingColors.length > 0) {
    return res
      .status(400)
      .json({ message: "Missing images for colors!", missingColors });
  }

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
  producer.send("product.created", { value: toProductEventPayload(product) });
  await invalidateCatalogCache();
  res.status(201).json(product);
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: Prisma.ProductUpdateInput = req.body;

  const { result: updatedProduct } = await measureAsync(
    "db.product.update",
    async () => {
      return await prisma.product.update({
        where: { id: Number(id) },
        data,
      });
    },
  );

  logger.info(`Product updated successfully with ID: ${id}`);
  producer.send("product.updated", { value: updatedProduct });
  await invalidateCatalogCache();
  return res.status(200).json(updatedProduct);
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  const { result: deletedProduct } = await measureAsync(
    "db.product.delete",
    async () => {
      return await prisma.product.delete({
        where: { id: Number(id) },
      });
    },
  );

  logger.info(`Product deleted with ID: ${id}`);
  producer.send("product.deleted", { value: Number(id) });
  await invalidateCatalogCache();

  return res.status(200).json(deletedProduct);
};

export const getProducts = async (req: Request, res: Response) => {
  const { sort, category, search, limit } = req.query;

  const query = {
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
          category: {
            slug: category as string,
          },
          name: {
            contains: search as string,
            mode: "insensitive",
          },
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
