import { Prisma, prisma } from "@repo/product-db";
import { Request, Response } from "express";
import { CategoryFormSchema, type CategoryEventPayload } from "@repo/types";
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
  const parsed = CategoryFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const data: Prisma.CategoryCreateInput = parsed.data;

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
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: "Invalid category ID format" });
  }

  const parsed = CategoryFormSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const data: Prisma.CategoryUpdateInput = parsed.data;

  const { result: category } = await measureAsync(
    "db.category.update",
    async () => {
      return await prisma.category.update({
        where: { id: categoryId },
        data,
      });
    },
  );

  logger.info(`Category updated: ID ${categoryId}`);
  publishEvent("category.updated", toCategoryEventPayload(category));
  await invalidateCatalogCache();
  return res.status(200).json(category);
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: "Invalid category ID format" });
  }

  const { result: category } = await measureAsync(
    "db.category.delete",
    async () => {
      return await prisma.category.delete({
        where: { id: categoryId },
      });
    },
  );

  logger.info(`Category deleted: ID ${categoryId}`);
  // Bare id, matching `product.deleted`: the catalog-service projector only needs
  // the identifier to deactivate the read-model row.
  publishEvent("category.deleted", categoryId);
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
