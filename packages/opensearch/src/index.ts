/**
 * @repo/opensearch — Shared OpenSearch infrastructure for Larekmart
 *
 * Public API surface:
 *
 * Client
 *   createOpenSearchClient(config)  — factory, no singleton
 *   pingOpenSearch(client)          — health probe
 *   Client                          — re-exported SDK type (no direct SDK imports)
 *
 * Index lifecycle
 *   ensureProductIndexExists(client, indexName, aliasName, logger?)
 *   pointAliasToIndex(client, indexName, aliasName, logger?)
 *   createNewVersionedIndex(client, versionedName, logger?)
 *
 * Index mappings
 *   PRODUCT_INDEX_SETTINGS          — raw settings + mappings constant
 *
 * Query builders (pure, stateless)
 *   buildProductSearchQuery(params, boosting?)
 *   buildSearchFilters(params)
 *   buildAutocompleteQuery(params)
 *
 * Search execution
 *   searchProductDocuments(client, targetIndex, params, boosting?, logger?)
 *
 * Bulk operations
 *   bulkIndexProducts(client, products, targetIndex, batchSize?, logger?)
 *
 * Single-document operations
 *   indexProductDocument(client, product, targetIndex, logger?)
 *   updateProductDocument(client, id, partialDoc, targetIndex, logger?)
 *   getProductDocument(client, id, targetIndex, logger?)
 *   deleteProductDocument(client, id, targetIndex, logger?)
 *
 * Reindexing
 *   reindexProducts(client, options, logger?)
 *
 * Types
 *   OpenSearchClientConfig
 *   SearchBoostingConfig
 *   ReindexOptions
 *   ReindexResult
 *   OpenSearchHit<T>
 *   OpenSearchSearchResponse<T>
 *   AggregationResult
 *   AggregationBucket
 *   BulkOperationResult
 *   ProductSearchResult<T>
 */

// ── Client ──────────────────────────────────────────────────────────────────
export { createOpenSearchClient, pingOpenSearch } from "./client.js";
export type { Client } from "@opensearch-project/opensearch";

// ── Index lifecycle ─────────────────────────────────────────────────────────-
export {
  ensureProductIndexExists,
  pointAliasToIndex,
  createNewVersionedIndex,
} from "./indexes/products.index.js";

// ── Mappings ─────────────────────────────────────────────────────────────────
export { PRODUCT_INDEX_SETTINGS } from "./indexes/product-mappings.js";

// ── Query builders ───────────────────────────────────────────────────────────
export { buildProductSearchQuery } from "./queries/product-search.js";
export { buildSearchFilters } from "./queries/filters.js";
export { buildAutocompleteQuery } from "./queries/autocomplete.js";

// ── Bulk operations ──────────────────────────────────────────────────────────
export { bulkIndexProducts } from "./bulk/bulk-index.js";

// ── Search execution ─────────────────────────────────────────────────────────
export { searchProductDocuments } from "./search.js";
export type { ProductSearchResult } from "./search.js";

// ── Single-document operations ───────────────────────────────────────────────
export {
  indexProductDocument,
  updateProductDocument,
  getProductDocument,
  deleteProductDocument,
} from "./documents.js";

// ── Reindexing ───────────────────────────────────────────────────────────────
export { reindexProducts } from "./reindex.js";

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  OpenSearchClientConfig,
  SearchBoostingConfig,
  ReindexOptions,
  ReindexResult,
  OpenSearchHit,
  OpenSearchSearchResponse,
  AggregationResult,
  AggregationBucket,
  BulkOperationResult,
} from "./types.js";
