import type {
  CatalogPaginatedResponseType,
  CatalogProductCardType,
  CatalogProductQueryType,
} from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
} from "../cache/catalog-cache.js";
import { catalogRepository } from "../repositories/catalog.repository.js";

export class CatalogService {
  async getProducts(
    query: CatalogProductQueryType,
  ): Promise<CatalogPaginatedResponseType> {
    // If it's a simple page request for a category, check category cache
    if (
      query.category &&
      !query.brand &&
      query.minPrice === undefined &&
      query.maxPrice === undefined &&
      query.availability === "all" &&
      query.sort === "newest" &&
      (query.page === 1 || query.page === 2)
    ) {
      const cacheKey = CatalogCacheKeys.category(query.category, query.page);
      const cached = await getCached<CatalogPaginatedResponseType>(cacheKey);
      if (cached) return cached;

      const result = await catalogRepository.findProducts(query);
      await setCached(cacheKey, result);
      return result;
    }

    return catalogRepository.findProducts(query);
  }

  async getProductById(
    idOrSlug: string,
  ): Promise<CatalogProductCardType | null> {
    const cacheKey = CatalogCacheKeys.productCard(idOrSlug);
    const cached = await getCached<CatalogProductCardType>(cacheKey);
    if (cached) return cached;

    let product = await catalogRepository.findProductById(idOrSlug);
    if (!product) {
      product = await catalogRepository.findProductBySlug(idOrSlug);
    }

    if (product) {
      await setCached(cacheKey, product);
    }
    return product;
  }

  async getFeaturedProducts(limit = 12): Promise<CatalogProductCardType[]> {
    const cacheKey = CatalogCacheKeys.featured();
    const cached = await getCached<CatalogProductCardType[]>(cacheKey);
    if (cached) return cached;

    const products = await catalogRepository.findFeaturedProducts(limit);
    await setCached(cacheKey, products);
    return products;
  }

  async getNewArrivals(limit = 12): Promise<CatalogProductCardType[]> {
    const cacheKey = CatalogCacheKeys.newArrivals();
    const cached = await getCached<CatalogProductCardType[]>(cacheKey);
    if (cached) return cached;

    const products = await catalogRepository.findNewArrivals(limit);
    await setCached(cacheKey, products);
    return products;
  }

  async getBestSellers(limit = 12): Promise<CatalogProductCardType[]> {
    const cacheKey = CatalogCacheKeys.bestSellers();
    const cached = await getCached<CatalogProductCardType[]>(cacheKey);
    if (cached) return cached;

    const products = await catalogRepository.findBestSellers(limit);
    await setCached(cacheKey, products);
    return products;
  }
}

export const catalogService = new CatalogService();
