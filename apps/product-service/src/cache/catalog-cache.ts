/**
 * Read-through cache for the catalog read endpoints.
 *
 * Product and category writes are infrequent and always flow through this
 * service, so these entries use **namespace versioning** rather than TTL-only
 * expiry: every mutation bumps one counter and all previously cached keys become
 * unreachable at once. There is nothing to enumerate or delete, and a stale
 * entry can never outlive a write.
 *
 * Cached values round-trip through JSON, so `Date` fields come back as ISO
 * strings. That is exactly what Express serialises over HTTP anyway, so the
 * response body is unchanged whether the value came from Redis or PostgreSQL.
 *
 * Every call is best-effort: `cacheRead` reports an unreachable Redis instead of
 * throwing, so callers always fall through to Prisma. Outcomes are classified by
 * `@repo/monitoring`'s `cacheMetrics.record` — hits, misses, and **Redis errors
 * counted separately** (`cache_type` labels `products`, `product`, `categories`)
 * — and surface at `GET /metrics` as `cache_hits_total`, `cache_misses_total`,
 * and `cache_errors_total`.
 */
import {
  bumpNamespaceVersion,
  cacheRead,
  cacheSet,
  getNamespaceVersion,
} from "@repo/redis";
import type { Category, Product } from "@repo/product-db";
import { redis } from "../utils/redis.js";
import { cacheMetrics } from "../observability/metrics.js";

/** In-memory fallback for the namespace version when Redis is unavailable. */
const namespaceVersionFallback = { value: 1 };

const NAMESPACE_VERSION_KEY = redis.keys.simple("namespace_version");

/** Parses a positive integer env value, falling back when unset or invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const PRODUCT_TTL_SECONDS = positiveInt(
  process.env.PRODUCT_CACHE_TTL_SECONDS,
  300,
);
const CATEGORY_TTL_SECONDS = positiveInt(
  process.env.CATEGORY_CACHE_TTL_SECONDS,
  300,
);

/** The list-endpoint query params that affect the response body. */
export interface ProductListQuery {
  sort?: string;
  category?: string;
  search?: string;
  limit?: string;
}

/** Reads the current cache namespace version from Redis (or memory). */
async function getCacheVersion(): Promise<number> {
  return getNamespaceVersion(
    redis.client,
    NAMESPACE_VERSION_KEY,
    namespaceVersionFallback,
  );
}

/**
 * Normalises list params into a stable cache-key fragment so equivalent
 * requests (`?sort=asc` vs `?sort=ASC&`) share one entry.
 */
function normalizeListQuery(query: ProductListQuery): string {
  return [
    query.sort ?? "default",
    query.category ?? "",
    query.search ?? "",
    query.limit ?? "all",
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

/** Returns the cached product list for `query`, or `null` on miss/error. */
export async function getCachedProducts(
  query: ProductListQuery,
): Promise<Product[] | null> {
  const version = await getCacheVersion();
  return cacheMetrics.record(
    await cacheRead<Product[]>(
      redis.client,
      redis.keys.namespace(
        `v${version}`,
        "products",
        normalizeListQuery(query),
      ),
    ),
    "products",
  );
}

/** Caches the product list for `query`. */
export async function setCachedProducts(
  query: ProductListQuery,
  products: Product[],
): Promise<void> {
  const version = await getCacheVersion();
  await cacheSet(
    redis.client,
    redis.keys.namespace(`v${version}`, "products", normalizeListQuery(query)),
    products,
    PRODUCT_TTL_SECONDS,
  );
}

/** Returns the cached product for `id`, or `null` on miss/error. */
export async function getCachedProduct(id: number): Promise<Product | null> {
  const version = await getCacheVersion();
  return cacheMetrics.record(
    await cacheRead<Product>(
      redis.client,
      redis.keys.namespace(`v${version}`, "product", id),
    ),
    "product",
  );
}

/** Caches a single product. */
export async function setCachedProduct(
  id: number,
  product: Product,
): Promise<void> {
  const version = await getCacheVersion();
  await cacheSet(
    redis.client,
    redis.keys.namespace(`v${version}`, "product", id),
    product,
    PRODUCT_TTL_SECONDS,
  );
}

/** Returns the cached category list, or `null` on miss/error. */
export async function getCachedCategories(): Promise<Category[] | null> {
  const version = await getCacheVersion();
  return cacheMetrics.record(
    await cacheRead<Category[]>(
      redis.client,
      redis.keys.namespace(`v${version}`, "categories"),
    ),
    "categories",
  );
}

/** Caches the category list. */
export async function setCachedCategories(
  categories: Category[],
): Promise<void> {
  const version = await getCacheVersion();
  await cacheSet(
    redis.client,
    redis.keys.namespace(`v${version}`, "categories"),
    categories,
    CATEGORY_TTL_SECONDS,
  );
}

/**
 * Invalidates every cached catalog entry by bumping the namespace version.
 *
 * Call this after any product or category mutation. It never throws — if Redis
 * is down the in-memory fallback still advances, so a subsequent recovery does
 * not resurrect pre-mutation entries.
 *
 * @returns The new namespace version.
 */
export async function invalidateCatalogCache(): Promise<number> {
  return bumpNamespaceVersion(
    redis.client,
    NAMESPACE_VERSION_KEY,
    namespaceVersionFallback,
  );
}
