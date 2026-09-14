import { reindexProducts } from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";
import { invalidateSearchCacheNamespace } from "../cache/search-cache.js";
import type { ReindexRequest, ReindexResponse } from "@repo/types";

export class ReindexService {
  async executeReindex(req: ReindexRequest): Promise<ReindexResponse> {
    const startTime = Date.now();
    const targetAlias = config.opensearch.aliasName;
    const newIndexName = req.targetIndex || `products-v${Date.now()}`;
    const sourceIndex = req.sourceIndex || targetAlias;

    logger.info(
      `Starting reindexing from [${sourceIndex}] to [${newIndexName}]`,
    );

    try {
      // Create target index with schema mappings, copy documents, swap alias.
      const result = await reindexProducts(getOpenSearchClient(), {
        sourceIndex,
        targetIndex: newIndexName,
        aliasName: targetAlias,
        batchSize: req.batchSize,
        recreateAlias: req.recreateAlias,
      });

      if (result.aliasSwapped) {
        logger.info(
          `Alias [${targetAlias}] successfully pointed to [${newIndexName}]`,
        );
      }

      // Invalidate search cache
      await invalidateSearchCacheNamespace();

      const durationMs = Date.now() - startTime;
      logger.info(`Reindex completed successfully in ${durationMs}ms`, {
        newIndexName,
        indexedCount: result.total,
        failedCount: result.failures.length,
      });

      return {
        success: true,
        message: `Reindexing completed successfully into ${newIndexName}`,
        indexedCount: result.total,
        failedCount: result.failures.length,
        newIndexName,
        aliasName: targetAlias,
        durationMs,
      };
    } catch (error: any) {
      logger.error("Reindexing failed", { error: error.message });
      return {
        success: false,
        message: `Reindex operation failed: ${error.message}`,
        indexedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export const reindexService = new ReindexService();
