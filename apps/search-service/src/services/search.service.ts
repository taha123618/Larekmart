import { searchProductDocuments } from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import {
  getCachedSearchResults,
  setCachedSearchResults,
} from "../cache/search-cache.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import { config } from "../config/config.js";
import type { SearchQueryParams, SearchResponse } from "@repo/types";

export class SearchService {
  async executeSearch(params: SearchQueryParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const hasQuery = Boolean(params.q && params.q.trim().length > 0);

    // 1. Try Redis Cache
    const cached = await getCachedSearchResults(params);
    if (cached) {
      return cached;
    }

    // 2. Query OpenSearch
    try {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "search",
        status: "start",
      });
      const opensearchStart = Date.now();

      const indexName = config.opensearch.aliasName;

      const result = await searchProductDocuments(
        getOpenSearchClient(),
        indexName,
        params,
        config.search.boosting,
        logger,
      );

      const opensearchDuration = (Date.now() - opensearchStart) / 1000;
      searchMetrics.opensearchDurationSeconds.observe(
        { operation: "search" },
        opensearchDuration,
      );
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "search",
        status: "success",
      });

      const took = Date.now() - startTime;
      const searchResponse: SearchResponse = {
        data: result.products,
        meta: {
          query: params.q,
          page: params.page,
          limit: params.limit,
          total: result.total,
          pages: Math.ceil(result.total / params.limit) || 1,
          took,
          fromCache: false,
        },
        facets: result.facets,
      };

      // 3. Cache search result in background
      await setCachedSearchResults(params, searchResponse);

      searchMetrics.searchRequestsTotal.inc({
        status: "success",
        has_query: String(hasQuery),
      });
      searchMetrics.searchDurationSeconds.observe(
        { has_query: String(hasQuery) },
        took / 1000,
      );

      return searchResponse;
    } catch (error: any) {
      searchMetrics.searchErrorsTotal.inc({
        error_type: error.name || "OpenSearchError",
      });
      searchMetrics.searchRequestsTotal.inc({
        status: "error",
        has_query: String(hasQuery),
      });
      logger.error("Error executing product search in OpenSearch", {
        params,
        error: error.message,
      });
      throw error;
    }
  }
}

export const searchService = new SearchService();
