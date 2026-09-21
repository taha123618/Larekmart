import type { FastifyPluginAsync } from "fastify";
import {
  getProductsHandler,
  getProductByIdHandler,
  getCategoriesHandler,
  getCategoryByIdHandler,
  getCategoryProductsHandler,
  getBrandsHandler,
  getBrandByIdHandler,
  getBrandProductsHandler,
  getCollectionsHandler,
  getCollectionByIdHandler,
  getFeaturedProductsHandler,
  getNewArrivalsHandler,
  getBestSellersHandler,
  getStorefrontOverviewHandler,
} from "../controllers/catalog.controller.js";

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // Product Discovery
  fastify.get("/products", getProductsHandler);
  fastify.get("/products/:id", getProductByIdHandler);

  // Categories & Trees
  fastify.get("/categories", getCategoriesHandler);
  fastify.get("/categories/:id", getCategoryByIdHandler);
  fastify.get("/categories/:id/products", getCategoryProductsHandler);

  // Brands
  fastify.get("/brands", getBrandsHandler);
  fastify.get("/brands/:id", getBrandByIdHandler);
  fastify.get("/brands/:id/products", getBrandProductsHandler);

  // Curated Collections & Merchandising
  fastify.get("/collections", getCollectionsHandler);
  fastify.get("/collections/:id", getCollectionByIdHandler);

  // High-traffic Merchandised Discovery
  fastify.get("/featured", getFeaturedProductsHandler);
  fastify.get("/new-arrivals", getNewArrivalsHandler);
  fastify.get("/best-sellers", getBestSellersHandler);
  fastify.get("/storefront", getStorefrontOverviewHandler);
};
