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
import { driftReconciler } from "./drift-reconciler.js";
import type { SearchProductDocument } from "@repo/types";

export interface BulkOperationItem {
  action: "index" | "update" | "delete";
  id: string | number;
  doc?: any;
}

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

      // Reconcile in-flight mutation if blue/green reindex is currently active
      await driftReconciler.recordUpsert(product);

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

      // Reconcile in-flight mutation if blue/green reindex is currently active
      await driftReconciler.recordPartialUpdate(id, partialDoc);

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

      // Reconcile in-flight mutation if blue/green reindex is currently active
      await driftReconciler.recordDelete(id);

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

  /**
   * High-throughput micro-batch execution using OpenSearch _bulk API.
   * Flushes up to N indexing/update/delete operations in a single HTTP roundtrip
   * and triggers a single search cache invalidation for the whole batch.
   */
  async bulkExecuteOperations(
    operations: BulkOperationItem[],
    indexName: string = config.opensearch.aliasName,
  ): Promise<{ successful: number; failed: number }> {
    if (operations.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const client = getOpenSearchClient();
    const body: any[] = [];

    for (const op of operations) {
      const docId = String(op.id);
      if (op.action === "index") {
        body.push({ index: { _index: indexName, _id: docId } });
        body.push(op.doc);
        await driftReconciler.recordUpsert(op.doc as SearchProductDocument);
      } else if (op.action === "update") {
        body.push({ update: { _index: indexName, _id: docId } });
        body.push({ doc: op.doc, doc_as_upsert: true });
        await driftReconciler.recordPartialUpdate(docId, op.doc);
      } else if (op.action === "delete") {
        body.push({ delete: { _index: indexName, _id: docId } });
        await driftReconciler.recordDelete(docId);
      }
    }

    try {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "bulk_ops",
        status: "start",
      });

      const response = await client.bulk({ body, refresh: false });
      let successful = 0;
      let failed = 0;

      const items = response.body?.items || (response as any).items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const actionKey = Object.keys(item)[0] as string;
          const status = item[actionKey]?.status;
          if (typeof status === "number" && status >= 200 && status < 300) {
            successful++;
          } else {
            failed++;
          }
        }
      } else {
        successful = operations.length;
      }

      searchMetrics.indexingDocumentsTotal.inc(
        { operation: "bulk", status: "success" },
        successful,
      );
      if (failed > 0) {
        searchMetrics.indexingDocumentsTotal.inc(
          { operation: "bulk", status: "error" },
          failed,
        );
      }
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "bulk_ops",
        status: "success",
      });

      // Single cache invalidation for the entire micro-batch
      await invalidateSearchCacheNamespace();

      logger.info(
        `Bulk executed ${operations.length} operations on [${indexName}]: ${successful} succeeded, ${failed} failed`,
      );

      return { successful, failed };
    } catch (error: any) {
      searchMetrics.opensearchRequestsTotal.inc({
        operation: "bulk_ops",
        status: "error",
      });
      logger.error("Failed to execute bulk operations on OpenSearch", {
        error: error.message,
        operationCount: operations.length,
      });
      throw error;
    }
  }
}

export const indexingService = new IndexingService();
