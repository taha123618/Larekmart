/**
 * search-service local type barrel.
 *
 * Domain types (SearchProductDocument, SearchQueryParams, etc.) come from @repo/types.
 * OpenSearch SDK wrapper types (OpenSearchHit, OpenSearchSearchResponse, etc.)
 * come from @repo/opensearch so they are shared and not duplicated.
 */
export * from "@repo/types";

export type {
  OpenSearchHit,
  OpenSearchSearchResponse,
  AggregationResult,
  BulkOperationResult,
  ProductSearchResult,
  ReindexOptions,
  ReindexResult,
} from "@repo/opensearch";

export {
  PRODUCT_INDEX_SETTINGS,
  buildSearchFilters,
  buildAutocompleteQuery,
} from "@repo/opensearch";
