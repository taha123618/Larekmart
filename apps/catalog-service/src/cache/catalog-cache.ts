import { cacheDel, cacheRead, cacheSet } from "@repo/redis";
import { env } from "../config/env.js";
import { cacheMetrics, logger } from "../observability/metrics.js";
import { redis } from "../utils/redis.js";

export { redis };

export const CatalogCacheKeys = {
  productCard: (productId: string) => redis.keys.simple(`product:${productId}`),
  category: (categoryId: string, page: number = 1) =>
    redis.keys.simple(`category:${categoryId}:page:${page}`),
  categoryTree: () => redis.keys.simple("category:tree"),
  brand: (brandId: string) => redis.keys.simple(`brand:${brandId}`),
  collection: (slug: string) => redis.keys.simple(`collection:${slug}`),
  featured: () => redis.keys.simple("curated:featured"),
  newArrivals: () => redis.keys.simple("curated:new-arrivals"),
  bestSellers: () => redis.keys.simple("curated:best-sellers"),
};

export async function getCached<T>(key: string): Promise<T | null> {
  const result = await cacheRead<T>(redis.client, key);
  if (result.status === "hit" && result.value) {
    cacheMetrics.hits.inc({ cache_type: "catalog" });
    return result.value;
  }
  if (result.status === "miss") {
    cacheMetrics.misses.inc({ cache_type: "catalog" });
    return null;
  }
  if (result.status === "error") {
    cacheMetrics.errors.inc({ cache_type: "catalog" });
    return null;
  }
  return null;
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number = env.CATALOG_CACHE_TTL_SECONDS,
): Promise<void> {
  try {
    await cacheSet(redis.client, key, data, ttlSeconds);
  } catch (err) {
    logger.warn("Failed to set catalog cache in Redis", {
      key,
      error: String(err),
    });
  }
}

export async function invalidateKey(key: string): Promise<void> {
  try {
    await cacheDel(redis.client, key);
  } catch (err) {
    logger.warn("Failed to invalidate cache key in Redis", {
      key,
      error: String(err),
    });
  }
}

export async function invalidateProductCache(
  productId: string,
  categoryId?: string | null,
  brandId?: string | null,
): Promise<void> {
  try {
    const keysToDelete = [
      CatalogCacheKeys.productCard(productId),
      CatalogCacheKeys.featured(),
      CatalogCacheKeys.newArrivals(),
      CatalogCacheKeys.bestSellers(),
    ];

    if (categoryId) {
      keysToDelete.push(CatalogCacheKeys.category(categoryId, 1));
      keysToDelete.push(CatalogCacheKeys.category(categoryId, 2));
    }
    if (brandId) {
      keysToDelete.push(CatalogCacheKeys.brand(brandId));
    }

    for (const key of keysToDelete) {
      await cacheDel(redis.client, key);
    }
  } catch (err) {
    logger.warn("Failed to invalidate product cache", {
      productId,
      error: String(err),
    });
  }
}

export async function invalidateCategoryCache(categoryId: string): Promise<void> {
  try {
    await cacheDel(redis.client, CatalogCacheKeys.categoryTree());
    await cacheDel(redis.client, CatalogCacheKeys.category(categoryId, 1));
    await cacheDel(redis.client, CatalogCacheKeys.category(categoryId, 2));
  } catch (err) {
    logger.warn("Failed to invalidate category cache", {
      categoryId,
      error: String(err),
    });
  }
}

export async function invalidateCollectionCache(slug: string): Promise<void> {
  try {
    await cacheDel(redis.client, CatalogCacheKeys.collection(slug));
  } catch (err) {
    logger.warn("Failed to invalidate collection cache", {
      slug,
      error: String(err),
    });
  }
}
