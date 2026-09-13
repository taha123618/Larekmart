import { createHash } from "node:crypto";
import { getRedisClient } from "../utils/redis.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import type { SearchQueryParams, SearchResponse } from "@repo/types";

let cachedNamespaceVersion = 1;

export function generateNormalizedSearchKey(params: SearchQueryParams, version: number = 1): string {
  // 1. Clean & normalize parameters into a stable sorted object
  const normalized: Record<string, any> = {};

  if (params.q) normalized.q = params.q.trim().toLowerCase();
  if (params.page) normalized.page = params.page;
  if (params.limit) normalized.limit = params.limit;
  if (params.sort) normalized.sort = params.sort;
  if (params.category) normalized.category = params.category.trim().toLowerCase();
  if (params.categorySlug) normalized.categorySlug = params.categorySlug.trim().toLowerCase();
  if (params.brand) normalized.brand = params.brand.trim().toLowerCase();
  if (params.min_price !== undefined) normalized.min_price = params.min_price;
  if (params.max_price !== undefined) normalized.max_price = params.max_price;
  // Multi-select facets — sorted so selection order can't split the cache key.
  if (params.color?.length) normalized.color = [...params.color].sort().join(",");
  if (params.size?.length) normalized.size = [...params.size].sort().join(",");
  if (params.inStock !== undefined) normalized.inStock = params.inStock;
  if (params.rating !== undefined) normalized.rating = params.rating;
  if (params.seller) normalized.seller = params.seller.trim().toLowerCase();
  if (params.tags) {
    normalized.tags = Array.isArray(params.tags)
      ? [...params.tags].sort().join(",")
      : params.tags;
  }

  // 2. Compute deterministic SHA256 hash
  const serialized = JSON.stringify(normalized, Object.keys(normalized).sort());
  const hash = createHash("sha256").update(serialized).digest("hex").substring(0, 16);

  return `${config.redis.keyPrefix}v${version}:q:${hash}`;
}

export async function getCacheVersion(): Promise<number> {
  try {
    const redis = getRedisClient();
    const versionStr = await redis.get(`${config.redis.keyPrefix}namespace_version`);
    if (versionStr) {
      cachedNamespaceVersion = parseInt(versionStr, 10) || 1;
    }
    return cachedNamespaceVersion;
  } catch (error) {
    return cachedNamespaceVersion;
  }
}

export async function invalidateSearchCacheNamespace(): Promise<number> {
  try {
    const redis = getRedisClient();
    const newVersion = await redis.incr(`${config.redis.keyPrefix}namespace_version`);
    cachedNamespaceVersion = newVersion;
    logger.info(`Search cache namespace invalidated, new version: ${newVersion}`);
    return newVersion;
  } catch (error) {
    cachedNamespaceVersion++;
    logger.warn("Failed to increment namespace version in Redis, bumped local in-memory version", { error });
    return cachedNamespaceVersion;
  }
}

export async function getCachedSearchResults(params: SearchQueryParams): Promise<SearchResponse | null> {
  try {
    const redis = getRedisClient();
    const version = await getCacheVersion();
    const key = generateNormalizedSearchKey(params, version);

    const data = await redis.get(key);
    if (!data) {
      searchMetrics.cacheMissesTotal.inc({ cache_type: "search" });
      return null;
    }

    searchMetrics.cacheHitsTotal.inc({ cache_type: "search" });
    const parsed: SearchResponse = JSON.parse(data);
    parsed.meta.fromCache = true;
    return parsed;
  } catch (error) {
    searchMetrics.cacheMissesTotal.inc({ cache_type: "search" });
    return null;
  }
}

export async function setCachedSearchResults(
  params: SearchQueryParams,
  response: SearchResponse,
  ttlSeconds: number = config.redis.searchCacheTtl,
): Promise<void> {
  try {
    const redis = getRedisClient();
    const version = await getCacheVersion();
    const key = generateNormalizedSearchKey(params, version);

    const serialized = JSON.stringify(response);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (error) {
    logger.warn("Failed to set search cache in Redis", { error });
  }
}
