import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import { invalidateSearchCacheNamespace } from "../cache/search-cache.js";
import {
  deleteProductDocument,
  indexProductDocument,
  updateProductDocument,
  getProductDocument,
} from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import type { SearchProductDocument } from "@repo/types";

export class IndexingService {
  async indexOrUpdateProduct(
    product: SearchProductDocument,
    indexName: string = config.opensearch.aliasName,
  ): Promise<void> {
    const docId = String(product.id);

    try {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "index_doc",
        status: "start",
      });
      await indexProductDocument(
        getOpenSearchClient(),
        product,
        indexName,
        logger,
      );

      searchMetrics.indexingDocumentsTotal.inc({
        operation: "index",
        status: "success",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "index_doc",
        status: "success",
      });
      logger.info(`Successfully indexed product [${docId}] to [${indexName}]`);

      // Invalidate cache
      await invalidateSearchCacheNamespace();
    } catch (error: any) {
      searchMetrics.indexingDocumentsTotal.inc({
        operation: "index",
        status: "error",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "index_doc",
        status: "error",
      });
      logger.error(`Failed to index product [${docId}]`, {
        error: error.message,
      });
      throw error;
    }
  }

  async updateProductPartial(
    id: string | number,
    partialDoc: Partial<SearchProductDocument>,
    indexName: string = config.opensearch.aliasName,
  ): Promise<void> {
    const docId = String(id);

    try {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "update_doc",
        status: "start",
      });
      await updateProductDocument(
        getOpenSearchClient(),
        id,
        partialDoc,
        indexName,
        logger,
      );

      searchMetrics.indexingDocumentsTotal.inc({
        operation: "update",
        status: "success",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "update_doc",
        status: "success",
      });
      logger.info(`Successfully updated product document [${docId}]`);

      await invalidateSearchCacheNamespace();
    } catch (error: any) {
      searchMetrics.indexingDocumentsTotal.inc({
        operation: "update",
        status: "error",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "update_doc",
        status: "error",
      });
      logger.error(`Failed to update product [${docId}]`, {
        error: error.message,
      });
      throw error;
    }
  }

  async deleteProduct(
    id: string | number,
    indexName: string = config.opensearch.aliasName,
  ): Promise<void> {
    const docId = String(id);

    try {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "delete_doc",
        status: "start",
      });
      await deleteProductDocument(getOpenSearchClient(), id, indexName, logger);

      searchMetrics.indexingDocumentsTotal.inc({
        operation: "delete",
        status: "success",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "delete_doc",
        status: "success",
      });
      logger.info(
        `Successfully deleted product [${docId}] from index [${indexName}]`,
      );

      await invalidateSearchCacheNamespace();
    } catch (error: any) {
      searchMetrics.indexingDocumentsTotal.inc({
        operation: "delete",
        status: "error",
      });
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "delete_doc",
        status: "error",
      });
      logger.error(`Failed to delete product [${docId}]`, {
        error: error.message,
      });
      throw error;
    }
  }
}

export const indexingService = new IndexingService();
