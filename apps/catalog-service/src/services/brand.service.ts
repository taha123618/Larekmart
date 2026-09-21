import type { CatalogBrandType, CatalogPaginatedResponseType } from "@repo/types";
import { CatalogCacheKeys, getCached, setCached } from "../cache/catalog-cache.js";
import { brandRepository } from "../repositories/brand.repository.js";
import { catalogRepository } from "../repositories/catalog.repository.js";

export class BrandService {
  async getAllBrands(): Promise<CatalogBrandType[]> {
    return brandRepository.findAllBrands();
  }

  async getBrandByIdOrSlug(idOrSlug: string): Promise<CatalogBrandType | null> {
    const cacheKey = CatalogCacheKeys.brand(idOrSlug);
    const cached = await getCached<CatalogBrandType>(cacheKey);
    if (cached) return cached;

    const brand = await brandRepository.findBrandByIdOrSlug(idOrSlug);
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
  ): Promise<CatalogPaginatedResponseType> {
    return catalogRepository.findProducts({
      brand: idOrSlug,
      page,
      limit,
      sort: sort as any,
      availability: "all",
    });
  }
}

export const brandService = new BrandService();
