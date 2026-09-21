import { Prisma, prisma } from "@repo/product-db";
import { Request, Response } from "express";
import type { CategoryEventPayload } from "@repo/types";
import { createLogger, measureAsync } from "@repo/monitoring";
import { publishEvent } from "../utils/kafka.js";
import {
  getCachedCategories,
  setCachedCategories,
  invalidateCatalogCache,
} from "../cache/catalog-cache.js";

const logger = createLogger("product-service:category-controller");

/**
 * Maps a category to the `category.created` / `category.updated` payload.
 *
 * product-service's `Category` model stores only id/name/slug today, so these are
 * the only fields the catalog-service read model can be given; it defaults the
 * rest (description, image, parentId, position, isActive) of `CatalogCategory`.
 */
const toCategoryEventPayload = (category: {
  id: number;
  name: string;
  slug: string;
}): CategoryEventPayload => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
});

export const createCategory = async (req: Request, res: Response) => {
  const data: Prisma.CategoryCreateInput = req.body;

  const { result: category } = await measureAsync(
    "db.category.create",
    async () => {
      return await prisma.category.create({ data });
    },
  );
  logger.info(`Category created: ${category.name}`);
  publishEvent("category.created", toCategoryEventPayload(category));
  await invalidateCatalogCache();
  res.status(201).json(category);
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: Prisma.CategoryUpdateInput = req.body;

  const { result: category } = await measureAsync(
    "db.category.update",
    async () => {
      return await prisma.category.update({
        where: { id: Number(id) },
        data,
      });
    },
  );

  logger.info(`Category updated: ID ${id}`);
  publishEvent("category.updated", toCategoryEventPayload(category));
  await invalidateCatalogCache();
  return res.status(200).json(category);
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  const { result: category } = await measureAsync(
    "db.category.delete",
    async () => {
      return await prisma.category.delete({
        where: { id: Number(id) },
      });
    },
  );

  logger.info(`Category deleted: ID ${id}`);
  // Bare id, matching `product.deleted`: the catalog-service projector only needs
  // the identifier to deactivate the read-model row.
  publishEvent("category.deleted", Number(id));
  await invalidateCatalogCache();
  return res.status(200).json(category);
};

export const getCategories = async (req: Request, res: Response) => {
  const cached = await getCachedCategories();
  if (cached) return res.status(200).json(cached);

  const { result: categories } = await measureAsync(
    "db.category.findMany",
    async () => {
      return await prisma.category.findMany();
    },
  );

  await setCachedCategories(categories);
  return res.status(200).json(categories);
};
