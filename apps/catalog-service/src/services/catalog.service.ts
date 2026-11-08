import type {
  CatalogPaginatedResponseType,
  CatalogProductCardType,
  CatalogProductQueryType,
} from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
  getCachedOrFetch,
} from "../cache/catalog-cache.js";
import { catalogRepository } from "../repositories/catalog.repository.js";
import { databaseContext } from "../utils/database-context.js";

export interface CatalogQueryOptions {
  forcePrimary?: boolean;
}

export class CatalogService {
  async getProducts(
    query: CatalogProductQueryType,
    options?: CatalogQueryOptions,
  ): Promise<CatalogPaginatedResponseType> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;

    // If Read-Your-Writes is active, bypass cache and fetch directly from primary master
    if (forcePrimary) {
      const result = await catalogRepository.findProducts(query, true);
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
        await setCached(cacheKey, result);
      }
      return result;
    }

    // Standard read-replica path: check cache first
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

      const result = await catalogRepository.findProducts(query, false);
      await setCached(cacheKey, result);
      return result;
    }

    return catalogRepository.findProducts(query, false);
  }

  async getProductById(
    idOrSlug: string,
    options?: CatalogQueryOptions,
  ): Promise<CatalogProductCardType | null> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.productCard(idOrSlug);

    // Bypass cache if client has active Read-Your-Writes consistency lease
    if (!forcePrimary) {
      return getCachedOrFetch(cacheKey, async () => {
        let product = await catalogRepository.findProductById(
          idOrSlug,
          forcePrimary,
        );
        if (!product) {
          product = await catalogRepository.findProductBySlug(
            idOrSlug,
            forcePrimary,
          );
        }
        return product;
      });
    }

    let product = await catalogRepository.findProductById(
      idOrSlug,
      forcePrimary,
    );
    if (!product) {
      product = await catalogRepository.findProductBySlug(
        idOrSlug,
        forcePrimary,
      );
    }
    return product;
  }

  async getFeaturedProducts(
    limit = 12,
    options?: CatalogQueryOptions,
  ): Promise<CatalogProductCardType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.featured();

    if (!forcePrimary) {
      return getCachedOrFetch(cacheKey, async () => {
        return catalogRepository.findFeaturedProducts(limit, forcePrimary);
      });
    }

    return catalogRepository.findFeaturedProducts(limit, forcePrimary);
  }

  async getNewArrivals(
    limit = 12,
    options?: CatalogQueryOptions,
  ): Promise<CatalogProductCardType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.newArrivals();

    if (!forcePrimary) {
      return getCachedOrFetch(cacheKey, async () => {
        return catalogRepository.findNewArrivals(limit, forcePrimary);
      });
    }

    return catalogRepository.findNewArrivals(limit, forcePrimary);
  }

  async getBestSellers(
    limit = 12,
    options?: CatalogQueryOptions,
  ): Promise<CatalogProductCardType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.bestSellers();

    if (!forcePrimary) {
      return getCachedOrFetch(cacheKey, async () => {
        return catalogRepository.findBestSellers(limit, forcePrimary);
      });
    }

    return catalogRepository.findBestSellers(limit, forcePrimary);
  }
}

export const catalogService = new CatalogService();
