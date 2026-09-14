import type { Client } from "@opensearch-project/opensearch";
import type { Logger } from "@repo/monitoring";
import type {
  SearchProductDocument,
  SearchQueryParams,
  SearchFacets,
} from "@repo/types";
import type {
  OpenSearchSearchResponse,
  SearchBoostingConfig,
} from "./types.js";
import { buildProductSearchQuery } from "./queries/product-search.js";

/** Normalized result of a product search — hits, total, and shaped facets. */
export interface ProductSearchResult<T = SearchProductDocument> {
  products: T[];
  total: number;
  facets: SearchFacets;
  /** OpenSearch-reported execution time in milliseconds. */
  took: number;
  /** The untransformed search response, for callers that need raw hits. */
  raw: OpenSearchSearchResponse<T>;
}

/**
 * Executes a product search against `targetIndex` and normalizes the response
 * into hits, total, and facet buckets.
 *
 * Owns the DSL execution + aggregation shaping so every service that reads the
 * product index returns the same shape; caching and metrics stay with callers.
 */
export async function searchProductDocuments(
  client: Client,
  targetIndex: string,
  params: SearchQueryParams,
  boosting?: SearchBoostingConfig,
  logger?: Logger,
): Promise<ProductSearchResult> {
  const queryDsl = buildProductSearchQuery(params, boosting);

  try {
    const response = await client.search({
      index: targetIndex,
      body: queryDsl,
    });

    const raw =
      response.body as unknown as OpenSearchSearchResponse<SearchProductDocument>;
    const hits = raw.hits?.hits ?? [];
    const aggs = raw.aggregations ?? {};

    // Facet aggregations are nested `global` → `filtered` → values/stats so each
    // one can exclude its own selection (see buildProductSearchQuery).
    const facets: SearchFacets = {
      categories: aggs.categories?.filtered?.values?.buckets ?? [],
      colors: aggs.colors?.filtered?.values?.buckets ?? [],
      sizes: aggs.sizes?.filtered?.values?.buckets ?? [],
      brands: aggs.brands?.filtered?.values?.buckets ?? [],
      price_stats: aggs.price_stats?.filtered?.stats
        ? {
            min: aggs.price_stats.filtered.stats.min ?? 0,
            max: aggs.price_stats.filtered.stats.max ?? 0,
            avg: aggs.price_stats.filtered.stats.avg ?? 0,
          }
        : undefined,
    };

    return {
      products: hits.map((hit) => hit._source),
      total: raw.hits?.total?.value ?? 0,
      facets,
      took: raw.took,
      raw,
    };
  } catch (error) {
    logger?.error(`Product search failed on [${targetIndex}]`, {
      error,
      params,
    });
    throw error;
  }
}
