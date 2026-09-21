import type { CatalogCategoryItemType, CatalogPaginatedResponseType } from "@repo/types";
import { CatalogCacheKeys, getCached, setCached } from "../cache/catalog-cache.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { catalogRepository } from "../repositories/catalog.repository.js";

export class CategoryService {
  async getCategoryTree(): Promise<CatalogCategoryItemType[]> {
    const cacheKey = CatalogCacheKeys.categoryTree();
    const cached = await getCached<CatalogCategoryItemType[]>(cacheKey);
    if (cached) return cached;

    const tree = await categoryRepository.findCategoryTree();
    await setCached(cacheKey, tree, 3600); // 1 hour TTL
    return tree;
  }

  async getAllCategories(): Promise<CatalogCategoryItemType[]> {
    return categoryRepository.findAllCategories();
  }

  async getCategoryByIdOrSlug(idOrSlug: string): Promise<CatalogCategoryItemType | null> {
    return categoryRepository.findCategoryByIdOrSlug(idOrSlug);
  }

  async getCategoryProducts(
    idOrSlug: string,
    page = 1,
    limit = 24,
    sort = "newest",
  ): Promise<CatalogPaginatedResponseType> {
    const cacheKey = CatalogCacheKeys.category(idOrSlug, page);
    if (sort === "newest" && (page === 1 || page === 2)) {
      const cached = await getCached<CatalogPaginatedResponseType>(cacheKey);
      if (cached) return cached;
    }

    const result = await catalogRepository.findProductsByCategory(idOrSlug, page, limit, sort);
    if (sort === "newest" && (page === 1 || page === 2)) {
      await setCached(cacheKey, result);
    }
    return result;
  }
}

export const categoryService = new CategoryService();
