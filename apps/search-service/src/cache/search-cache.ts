import { createHash } from "node:crypto";
import {
  cacheRead,
  cacheSet,
  bumpNamespaceVersion,
  getNamespaceVersion,
} from "@repo/redis";
import { redis } from "../utils/redis.js";
import { config } from "../config/config.js";
import { logger, cacheMetrics } from "../observability/metrics.js";
import type { SearchQueryParams, SearchResponse } from "@repo/types";

/** In-memory fallback for the namespace version when Redis is unavailable. */
const namespaceVersionFallback = { value: 1 };

const NAMESPACE_VERSION_KEY = redis.keys.simple("namespace_version");

/**
 * Produces a deterministic, content-addressed cache key for a search query.
 *
 * The key embeds the namespace version so that calling
 * `invalidateSearchCacheNamespace` instantly makes all existing keys
 * unreachable without having to delete them explicitly.
 */
export function generateNormalizedSearchKey(
  params: SearchQueryParams,
  version: number = 1,
): string {
  // Normalize parameters into a stable sorted object.
  const normalized: Record<string, unknown> = {};

  if (params.q) normalized.q = params.q.trim().toLowerCase();
  if (params.page) normalized.page = params.page;
  if (params.limit) normalized.limit = params.limit;
  if (params.sort) normalized.sort = params.sort;
  if (params.category)
    normalized.category = params.category.trim().toLowerCase();
  if (params.categorySlug)
    normalized.categorySlug = params.categorySlug.trim().toLowerCase();
  if (params.brand) normalized.brand = params.brand.trim().toLowerCase();
  if (params.min_price !== undefined) normalized.min_price = params.min_price;
  if (params.max_price !== undefined) normalized.max_price = params.max_price;
  // Multi-select facets — sorted so selection order can't split the cache key.
  if (params.color?.length)
    normalized.color = [...params.color].sort().join(",");
  if (params.size?.length) normalized.size = [...params.size].sort().join(",");
  if (params.inStock !== undefined) normalized.inStock = params.inStock;
  if (params.rating !== undefined) normalized.rating = params.rating;
  if (params.seller) normalized.seller = params.seller.trim().toLowerCase();
  if (params.tags) {
    normalized.tags = Array.isArray(params.tags)
      ? [...params.tags].sort().join(",")
      : params.tags;
  }

  // Deterministic SHA-256 hash (first 16 hex chars = 64-bit collision space).
  const serialized = JSON.stringify(normalized, Object.keys(normalized).sort());
  const hash = createHash("sha256")
    .update(serialized)
    .digest("hex")
    .substring(0, 16);

  return redis.keys.namespace(`v${version}`, "q", hash);
}

/** Reads the current cache namespace version from Redis (or memory). */
export async function getCacheVersion(): Promise<number> {
  return getNamespaceVersion(
    redis.client,
    NAMESPACE_VERSION_KEY,
    namespaceVersionFallback,
  );
}

/**
 * Atomically bumps the namespace version, effectively invalidating all
 * existing search cache keys without needing to delete them.
 */
export async function invalidateSearchCacheNamespace(): Promise<number> {
  const newVersion = await bumpNamespaceVersion(
    redis.client,
    NAMESPACE_VERSION_KEY,
    namespaceVersionFallback,
  );
  logger.info(`Search cache namespace invalidated, new version: ${newVersion}`);
  return newVersion;
}

/** Returns cached search results for `params`, or `null` on miss/error. */
export async function getCachedSearchResults(
  params: SearchQueryParams,
): Promise<SearchResponse | null> {
  const version = await getCacheVersion();
  const key = generateNormalizedSearchKey(params, version);

  const cached = cacheMetrics.record(
    await cacheRead<SearchResponse>(redis.client, key),
    "search",
  );

  if (cached === null) return null;

  cached.meta.fromCache = true;
  return cached;
}

/** Writes search results to Redis with the configured TTL. */
export async function setCachedSearchResults(
  params: SearchQueryParams,
  response: SearchResponse,
  ttlSeconds: number = config.redis.searchCacheTtl,
): Promise<void> {
  const version = await getCacheVersion();
  const key = generateNormalizedSearchKey(params, version);
  await cacheSet(redis.client, key, response, ttlSeconds);
}
