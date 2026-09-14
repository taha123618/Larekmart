import type { Client } from "@opensearch-project/opensearch";
import type { SearchProductDocument } from "@repo/types";
import type { Logger } from "@repo/monitoring";

/**
 * Single-document operations against the product index.
 *
 * These mirror `bulkIndexProducts` for one-off writes (Kafka event handling)
 * and keep the refresh/upsert/404 semantics in one shared place so services
 * cannot drift from each other.
 */

/**
 * Indexes (creates or fully replaces) a single product document.
 * Refreshes the target index so the write is immediately searchable.
 */
export async function indexProductDocument(
  client: Client,
  product: SearchProductDocument,
  targetIndex: string,
  logger?: Logger,
): Promise<void> {
  const docId = String(product.id);

  try {
    await client.index({
      index: targetIndex,
      id: docId,
      body: product,
      refresh: true,
    });
    logger?.info(`Indexed product document [${docId}] into [${targetIndex}]`);
  } catch (error) {
    logger?.error(`Failed to index product document [${docId}]`, { error });
    throw error;
  }
}

/**
 * Partially updates a document via the update API with `doc_as_upsert`,
 * so an update for a missing document creates it instead of failing.
 * Always stamps `updatedAt`.
 */
export async function updateProductDocument(
  client: Client,
  id: string | number,
  partialDoc: Partial<SearchProductDocument>,
  targetIndex: string,
  logger?: Logger,
): Promise<void> {
  const docId = String(id);

  try {
    await client.update({
      index: targetIndex,
      id: docId,
      body: {
        doc: {
          ...partialDoc,
          updatedAt: new Date().toISOString(),
        },
        doc_as_upsert: true,
      },
      refresh: true,
    });
    logger?.info(`Updated product document [${docId}] in [${targetIndex}]`);
  } catch (error) {
    logger?.error(`Failed to update product document [${docId}]`, { error });
    throw error;
  }
}

/**
 * Fetches a single product document by id.
 * Returns `null` when the document is missing (404) instead of throwing.
 */
export async function getProductDocument(
  client: Client,
  id: string | number,
  targetIndex: string,
  logger?: Logger,
): Promise<SearchProductDocument | null> {
  const docId = String(id);

  try {
    const response = await client.get(
      { index: targetIndex, id: docId },
      { ignore: [404] },
    );

    const source = (response.body as { _source?: SearchProductDocument })
      ._source;
    if (response.statusCode === 404 || !source) {
      return null;
    }
    return source;
  } catch (error) {
    logger?.error(`Failed to get product document [${docId}]`, { error });
    throw error;
  }
}

/**
 * Deletes a single product document. Missing documents are treated as success
 * (idempotent deletes for `product.deleted` events).
 */
export async function deleteProductDocument(
  client: Client,
  id: string | number,
  targetIndex: string,
  logger?: Logger,
): Promise<void> {
  const docId = String(id);

  try {
    await client.delete(
      {
        index: targetIndex,
        id: docId,
        refresh: true,
      },
      { ignore: [404] },
    );
    logger?.info(`Deleted product document [${docId}] from [${targetIndex}]`);
  } catch (error) {
    logger?.error(`Failed to delete product document [${docId}]`, { error });
    throw error;
  }
}
