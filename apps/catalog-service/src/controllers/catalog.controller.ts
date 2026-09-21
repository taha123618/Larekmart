import type { FastifyReply, FastifyRequest } from "fastify";
import { CatalogProductQuerySchema } from "@repo/types";
import { catalogService } from "../services/catalog.service.js";
import { categoryService } from "../services/category.service.js";
import { brandService } from "../services/brand.service.js";
import { collectionService } from "../services/collection.service.js";
import { merchandisingService } from "../services/merchandising.service.js";
import { httpMetrics, logger } from "../observability/metrics.js";

export async function getProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();
  try {
    const parsed = CatalogProductQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      httpMetrics.requestsTotal.inc({ method: "GET", path: "/products", status: "400" });
      return reply.status(400).send({
        message: "Invalid query parameters",
        errors: parsed.error.issues,
      });
    }

    const result = await catalogService.getProducts(parsed.data);
    const duration = (Date.now() - startTime) / 1000;
    httpMetrics.requestDuration.observe({ method: "GET", path: "/products" }, duration);
    httpMetrics.requestsTotal.inc({ method: "GET", path: "/products", status: "200" });

    return reply.status(200).send(result);
  } catch (error) {
    logger.error("Failed to get products", { error: String(error) });
    httpMetrics.requestsTotal.inc({ method: "GET", path: "/products", status: "500" });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getProductByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const product = await catalogService.getProductById(id);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }
    return reply.status(200).send(product);
  } catch (error) {
    logger.error("Failed to get product by ID", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCategoriesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { tree?: string };
    if (query.tree === "true" || query.tree === "1") {
      const tree = await categoryService.getCategoryTree();
      return reply.status(200).send(tree);
    }
    const categories = await categoryService.getAllCategories();
    return reply.status(200).send(categories);
  } catch (error) {
    logger.error("Failed to get categories", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCategoryByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const category = await categoryService.getCategoryByIdOrSlug(id);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }
    return reply.status(200).send(category);
  } catch (error) {
    logger.error("Failed to get category", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCategoryProductsHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string; sort?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 24;
    const sort = request.query.sort || "newest";

    const result = await categoryService.getCategoryProducts(id, page, limit, sort);
    return reply.status(200).send(result);
  } catch (error) {
    logger.error("Failed to get category products", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getBrandsHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const brands = await brandService.getAllBrands();
    return reply.status(200).send(brands);
  } catch (error) {
    logger.error("Failed to get brands", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getBrandByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const brand = await brandService.getBrandByIdOrSlug(id);
    if (!brand) {
      return reply.status(404).send({ message: "Brand not found" });
    }
    return reply.status(200).send(brand);
  } catch (error) {
    logger.error("Failed to get brand", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getBrandProductsHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string; sort?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 24;
    const sort = request.query.sort || "newest";

    const result = await brandService.getBrandProducts(id, page, limit, sort);
    return reply.status(200).send(result);
  } catch (error) {
    logger.error("Failed to get brand products", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCollectionsHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const collections = await collectionService.getAllCollections();
    return reply.status(200).send(collections);
  } catch (error) {
    logger.error("Failed to get collections", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCollectionByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const collection = await collectionService.getCollectionBySlugOrId(id);
    if (!collection) {
      return reply.status(404).send({ message: "Collection not found" });
    }
    return reply.status(200).send(collection);
  } catch (error) {
    logger.error("Failed to get collection", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getFeaturedProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 12;
    const products = await catalogService.getFeaturedProducts(limit);
    return reply.status(200).send(products);
  } catch (error) {
    logger.error("Failed to get featured products", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getNewArrivalsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 12;
    const products = await catalogService.getNewArrivals(limit);
    return reply.status(200).send(products);
  } catch (error) {
    logger.error("Failed to get new arrivals", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getBestSellersHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 12;
    const products = await catalogService.getBestSellers(limit);
    return reply.status(200).send(products);
  } catch (error) {
    logger.error("Failed to get best sellers", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getStorefrontOverviewHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const overview = await merchandisingService.getStorefrontOverview();
    return reply.status(200).send(overview);
  } catch (error) {
    logger.error("Failed to get storefront overview", { error: String(error) });
    return reply.status(500).send({ message: "Internal server error" });
  }
}
