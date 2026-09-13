import type { Client } from "@opensearch-project/opensearch";
import type { SearchProductDocument } from "@repo/types";
import type { BulkOperationResult } from "../types.js";
import type { Logger } from "@repo/monitoring";

/**
 * Bulk-indexes an array of product documents into OpenSearch.
 *
 * Processes documents in configurable batches (default 250).
 * Each batch uses the OpenSearch Bulk API. Documents are indexed
 * by their `id` field as the `_id`.
 *
 * @param client      - OpenSearch client instance
 * @param products    - Documents to index
 * @param targetIndex - Index or alias name to write to
 * @param batchSize   - Documents per bulk request (default 250)
 * @param logger      - Optional structured logger
 */
export async function bulkIndexProducts(
  client: Client,
  products: SearchProductDocument[],
  targetIndex: string,
  batchSize = 250,
  logger?: Logger,
): Promise<BulkOperationResult> {
  const startTime = Date.now();
  let indexed = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const body: any[] = [];

    for (const doc of batch) {
      body.push({ index: { _index: targetIndex, _id: doc.id } });
      body.push(doc);
    }

    try {
      const response = await client.bulk({ body, refresh: true });
      const items: any[] = response.body?.items ?? [];

      for (const item of items) {
        const action = item.index ?? item.create ?? item.update;
        if (action?.error) {
          failed++;
          errors.push({
            id: action._id ?? "unknown",
            error: JSON.stringify(action.error),
          });
        } else {
          indexed++;
        }
      }
    } catch (error: any) {
      logger?.error(`Bulk batch failed for index [${targetIndex}]`, {
        error: error.message,
        batchSize: batch.length,
      });
      failed += batch.length;
      for (const doc of batch) {
        errors.push({ id: doc.id, error: error.message ?? "Bulk operation failure" });
      }
    }
  }

  const took = Date.now() - startTime;
  logger?.info(`Bulk indexing finished for [${targetIndex}] in ${took}ms`, {
    total: products.length,
    indexed,
    failed,
  });

  return { indexed, failed, errors, took };
}
