import type {
  CatalogCategoryItemType,
  CatalogPaginatedResponseType,
} from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
} from "../cache/catalog-cache.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { catalogRepository } from "../repositories/catalog.repository.js";
import { databaseContext } from "../utils/database-context.js";

export interface CategoryQueryOptions {
  forcePrimary?: boolean;
}

export class CategoryService {
  async getCategoryTree(
    options?: CategoryQueryOptions,
  ): Promise<CatalogCategoryItemType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.categoryTree();

    if (!forcePrimary) {
      const cached = await getCached<CatalogCategoryItemType[]>(cacheKey);
      if (cached) return cached;
    }

    const tree = await categoryRepository.findCategoryTree(forcePrimary);
    await setCached(cacheKey, tree, 3600); // 1 hour TTL
    return tree;
  }

  async getAllCategories(
    options?: CategoryQueryOptions,
  ): Promise<CatalogCategoryItemType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    return categoryRepository.findAllCategories(forcePrimary);
  }

  async getCategoryByIdOrSlug(
    idOrSlug: string,
    options?: CategoryQueryOptions,
  ): Promise<CatalogCategoryItemType | null> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    return categoryRepository.findCategoryByIdOrSlug(idOrSlug, forcePrimary);
  }

  async getCategoryProducts(
    idOrSlug: string,
    page = 1,
    limit = 24,
    sort = "newest",
    options?: CategoryQueryOptions,
  ): Promise<CatalogPaginatedResponseType> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.category(idOrSlug, page);

    if (!forcePrimary && sort === "newest" && (page === 1 || page === 2)) {
      const cached = await getCached<CatalogPaginatedResponseType>(cacheKey);
      if (cached) return cached;
    }

    const result = await catalogRepository.findProductsByCategory(
      idOrSlug,
      page,
      limit,
      sort,
      forcePrimary,
    );
    if (sort === "newest" && (page === 1 || page === 2)) {
      await setCached(cacheKey, result);
    }
    return result;
  }
}

export const categoryService = new CategoryService();
