import { Prisma, prisma } from "@repo/product-db";
import { Request, Response } from "express";
import { createLogger, measureAsync } from "@repo/monitoring";
import {
  getCachedCategories,
  setCachedCategories,
  invalidateCatalogCache,
} from "../cache/catalog-cache.js";

const logger = createLogger("product-service:category-controller");

export const createCategory = async (req: Request, res: Response) => {
  const data: Prisma.CategoryCreateInput = req.body;

  const { result: category } = await measureAsync(
    "db.category.create",
    async () => {
      return await prisma.category.create({ data });
    },
  );
  logger.info(`Category created: ${category.name}`);
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
