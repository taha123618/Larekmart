import { Prisma, prisma } from "@repo/product-db";
import { Request, Response } from "express";
import { CategoryFormSchema, type CategoryEventPayload } from "@repo/types";
import { createLogger, measureAsync } from "@repo/monitoring";
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
      return await prisma.$transaction(async (tx) => {
        const created = await tx.category.create({ data });
        await tx.outboxEvent.create({
          data: {
            topic: "category.created",
            payload: toCategoryEventPayload(created) as unknown as Prisma.InputJsonValue,
          },
        });
        return created;
      });
    },
  );
  logger.info(`Category created: ${category.name}`);
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
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id: categoryId },
          data,
        });
        await tx.outboxEvent.create({
          data: {
            topic: "category.updated",
            payload: toCategoryEventPayload(updated) as unknown as Prisma.InputJsonValue,
          },
        });
        return updated;
      });
    },
  );

  logger.info(`Category updated: ID ${categoryId}`);
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
      return await prisma.$transaction(async (tx) => {
        const deleted = await tx.category.delete({
          where: { id: categoryId },
        });
        await tx.outboxEvent.create({
          data: {
            topic: "category.deleted",
            payload: categoryId,
          },
        });
        return deleted;
      });
    },
  );

  logger.info(`Category deleted: ID ${categoryId}`);
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
