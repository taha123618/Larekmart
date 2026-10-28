import { z } from "zod";

/**
 * Denormalized searchable product document stored in OpenSearch
 */
export interface SearchProductDocument {
  id: string;
  sku?: string;
  slug?: string;
  name: string;
  shortDescription?: string;
  description: string;
  brand?: string;
  category: string;
  categorySlug: string;
  category_id?: number;
  subcategories?: string[];
  tags?: string[];
  attributes?: Record<string, string | number | boolean>;
  price: number;
  compareAtPrice?: number;
  discountPercentage?: number;
  currency?: string;
  sizes: string[];
  colors: string[];
  images: Record<string, string>;
  inStock: boolean;
  stockQuantity?: number;
  rating?: number;
  reviewCount?: number;
  sellerId?: string;
  sellerName?: string;
  isActive: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalizes a repeatable or comma-separated query param into a lowercased,
 * de-duplicated value list — e.g. `?color=red,blue` or `?color=red&color=blue`.
 *
 * Multi-select facet filters share one contract for single and multiple
 * selections, so the index only ever receives normalized keyword values.
 */
const MultiValueParamSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => [
    ...new Set(
      (typeof val === "string" ? val.split(",") : val)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]);

/**
 * Search Query Parameters Schema
 */
export const SearchQueryParamsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum([
      "relevance",
      "price_asc",
      "price_desc",
      "newest",
      "oldest",
      "rating",
      "popularity",
      "discount",
    ])
    .default("relevance"),
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  brand: z.string().optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  color: MultiValueParamSchema.optional(),
  size: MultiValueParamSchema.optional(),
  inStock: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  seller: z.string().optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (typeof val === "string" ? val.split(",") : val))
    .optional(),
});

export type SearchQueryParams = z.infer<typeof SearchQueryParamsSchema>;

/**
 * Autocomplete / Suggestions Query Schema
 */
export const SuggestionQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SuggestionQuery = z.infer<typeof SuggestionQuerySchema>;

/**
 * Aggregations / Facets Structure
 */
export interface FacetBucket {
  key: string | number;
  doc_count: number;
}

export interface SearchFacets {
  categories: FacetBucket[];
  colors: FacetBucket[];
  sizes: FacetBucket[];
  brands: FacetBucket[];
  price_stats?: {
    min: number;
    max: number;
    avg: number;
  };
  rating_buckets?: FacetBucket[];
}

/**
 * Search API Response Structure
 */
export interface SearchResultMeta {
  query?: string;
  page: number;
  limit: number;
  total: number;
  pages: number;
  took: number;
  fromCache?: boolean;
}

export interface SearchResponse<T = SearchProductDocument> {
  data: T[];
  meta: SearchResultMeta;
  facets?: SearchFacets;
}

/**
 * A single rich autocomplete suggestion. Carries the indexed product fields the
 * storefront needs to render the suggestion and deep-link to the detail page.
 */
export interface SuggestionItem {
  id: string;
  name: string;
  slug?: string;
  brand?: string;
  category?: string;
  categorySlug?: string;
  price?: number;
  images?: Record<string, string>;
}

/**
 * Suggestion Response Structure
 */
export interface SuggestionResponse {
  data: SuggestionItem[];
  took?: number;
  fromCache?: boolean;
}

/**
 * Reindexing Request and Response Contracts
 */
export const ReindexRequestSchema = z.object({
  sourceIndex: z.string().optional(),
  targetIndex: z.string().optional(),
  batchSize: z.number().int().min(10).max(5000).default(500),
  recreateAlias: z.boolean().default(true),
});

export type ReindexRequest = z.infer<typeof ReindexRequestSchema>;

export type ReindexJobStatus =
  | "INITIALIZING"
  | "COPYING_DOCUMENTS"
  | "RECONCILING_DRIFT"
  | "SWAPPING_ALIAS"
  | "COMPLETED"
  | "FAILED"
  | "ABORTED";

export interface ReindexJobRecord {
  jobId: string;
  status: ReindexJobStatus;
  sourceIndex: string;
  targetIndex: string;
  aliasName: string;
  batchSize: number;
  recreateAlias: boolean;
  indexedCount: number;
  failedCount: number;
  driftReconciledCount: number;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
}

export interface ReindexResponse {
  success: boolean;
  message: string;
  jobId?: string;
  indexedCount: number;
  failedCount: number;
  driftReconciledCount?: number;
  newIndexName?: string;
  aliasName?: string;
  durationMs: number;
}

export const RollbackRequestSchema = z.object({
  aliasName: z.string().optional(),
  targetIndex: z.string().min(1, "Target index is required for rollback"),
});

export type RollbackRequest = z.infer<typeof RollbackRequestSchema>;

export interface AliasTopologyResponse {
  aliasName: string;
  currentIndex: string | null;
  allIndices: string[];
  retainedIndices: string[];
}

/**
 * Search Index Backfill Request Contract
 *
 * Republishing the catalog heals documents indexed before `product.created`
 * carried the full product (missing images, sizes, and colors).
 *
 * Windowed on purpose: a run stops once it exhausts its time budget and returns
 * `nextAfterId`, so an HTTP caller can continue the sweep without a single
 * request outliving its timeout.
 */
export const SearchBackfillRequestSchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  afterId: z.coerce.number().int().min(0).optional(),
  timeBudgetMs: z.coerce.number().int().min(1000).max(120_000).optional(),
  dryRun: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .optional(),
});

export type SearchBackfillRequest = z.infer<typeof SearchBackfillRequestSchema>;

/** Progress of one search-index backfill window. */
export interface SearchBackfillResult {
  /** Products read from the catalog. */
  processed: number;
  /** `product.updated` events published (would-be count on a dry run). */
  published: number;
  /** Products whose event could not be published. */
  failed: number;
  /** Pass as `afterId` on the next call; absent once the sweep is finished. */
  nextAfterId?: number;
  /** True when the run stopped before reaching the end of the catalog. */
  hasMore: boolean;
}

/** HTTP response for a backfill window. */
export interface SearchBackfillResponse extends SearchBackfillResult {
  durationMs: number;
}
