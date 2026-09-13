import { getOpenSearchClient } from "../opensearch/client.js";
import { buildAutocompleteQuery } from "@repo/opensearch";
import { getCachedSuggestions, setCachedSuggestions } from "../cache/suggestion-cache.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import type { SuggestionItem, SuggestionQuery, SuggestionResponse } from "@repo/types";
import type { OpenSearchSearchResponse } from "@repo/opensearch";

export class SuggestionService {
  async getSuggestions(params: SuggestionQuery): Promise<SuggestionResponse> {
    const startTime = Date.now();

    // 1. Check Redis Cache
    const cached = await getCachedSuggestions(params);
    if (cached) {
      return cached;
    }

    // 2. Query OpenSearch
    const client = getOpenSearchClient();
    const queryDsl = buildAutocompleteQuery(params);

    try {
      searchMetrics.opensearchRequestsTotal.inc({ operation: "suggestions", status: "start" });
      const response = await client.search({
        index: config.opensearch.aliasName,
        body: queryDsl,
      });
      searchMetrics.opensearchRequestsTotal.inc({ operation: "suggestions", status: "success" });

      const rawBody = response.body as unknown as OpenSearchSearchResponse<SuggestionItem>;
      const hits = rawBody.hits?.hits ?? [];

      // Deduplicate by product id so each suggestion maps to a single product.
      const seen = new Set<string>();
      const suggestions: SuggestionItem[] = [];

      for (const hit of hits) {
        const item = hit._source;
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        suggestions.push(item);
        if (suggestions.length >= params.limit) break;
      }

      const took = Date.now() - startTime;
      const result: SuggestionResponse = {
        data: suggestions,
        took,
        fromCache: false,
      };

      // 3. Cache suggestions
      await setCachedSuggestions(params, result);

      return result;
    } catch (error: any) {
      logger.error("Error executing autocomplete in OpenSearch", {
        params,
        error: error.message,
      });
      return {
        data: [],
        took: Date.now() - startTime,
        fromCache: false,
      };
    }
  }
}

export const suggestionService = new SuggestionService();
