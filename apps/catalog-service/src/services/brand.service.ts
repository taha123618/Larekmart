import type {
  CatalogBrandType,
  CatalogPaginatedResponseType,
} from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
} from "../cache/catalog-cache.js";
import { brandRepository } from "../repositories/brand.repository.js";
import { catalogRepository } from "../repositories/catalog.repository.js";
import { databaseContext } from "../utils/database-context.js";

export interface BrandQueryOptions {
  forcePrimary?: boolean;
}

export class BrandService {
  async getAllBrands(options?: BrandQueryOptions): Promise<CatalogBrandType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    return brandRepository.findAllBrands(forcePrimary);
  }

  async getBrandByIdOrSlug(
    idOrSlug: string,
    options?: BrandQueryOptions,
  ): Promise<CatalogBrandType | null> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.brand(idOrSlug);

    if (!forcePrimary) {
      const cached = await getCached<CatalogBrandType>(cacheKey);
      if (cached) return cached;
    }

    const brand = await brandRepository.findBrandByIdOrSlug(
      idOrSlug,
      forcePrimary,
    );
    if (brand) {
      await setCached(cacheKey, brand);
    }
    return brand;
  }

  async getBrandProducts(
    idOrSlug: string,
    page = 1,
    limit = 24,
    sort = "newest",
    options?: BrandQueryOptions,
  ): Promise<CatalogPaginatedResponseType> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    return catalogRepository.findProducts(
      {
        brand: idOrSlug,
        page,
        limit,
        sort: sort as any,
        availability: "all",
      },
      forcePrimary,
    );
  }
}

export const brandService = new BrandService();
