import { Request, Response } from "express";
import { prisma, Prisma } from "@repo/product-db";
import { producer } from "../utils/kafka";
import { StripeProductType } from "@repo/types";
import { createLogger, measureAsync } from "@repo/monitoring";

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

  const stripeProduct: StripeProductType = {
    id: product.id.toString(),
    name: product.name,
    price: product.price,
  };

  producer.send("product.created", { value: stripeProduct });
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

  return res.status(200).json(deletedProduct);
};

export const getProducts = async (req: Request, res: Response) => {
  const { sort, category, search, limit } = req.query;

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

  res.status(200).json(products);
};

export const getProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  const { result: product } = await measureAsync(
    "db.product.findUnique",
    async () => {
      return await prisma.product.findUnique({
        where: { id: Number(id) },
      });
    },
  );

  return res.status(200).json(product);
};
