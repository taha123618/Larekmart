import type { Client } from "@opensearch-project/opensearch";
import type { Logger } from "@repo/monitoring";
import { createNewVersionedIndex, pointAliasToIndex } from "./indexes/products.index.js";
import type { ReindexOptions, ReindexResult } from "./types.js";

/**
 * Runs the full zero-downtime reindex flow:
 *
 * 1. Creates the target index with the current product mappings (skipped if it
 *    already exists, so a failed reindex can be retried into the same index).
 * 2. Copies every document from `sourceIndex` with the native `_reindex` API.
 * 3. Optionally atomically swaps `aliasName` to the target index.
 *
 * The native reindex runs synchronously (`wait_for_completion: true`), so the
 * returned counts are final when the promise resolves.
 */
export async function reindexProducts(
  client: Client,
  options: ReindexOptions,
  logger?: Logger,
): Promise<ReindexResult> {
  const startTime = Date.now();
  const {
    sourceIndex,
    targetIndex,
    aliasName,
    batchSize = 500,
    recreateAlias = false,
  } = options;

  logger?.info(`Starting reindex [${sourceIndex}] → [${targetIndex}]`);

  const existsResponse = await client.indices.exists({ index: targetIndex });
  if (!existsResponse.body) {
    await createNewVersionedIndex(client, targetIndex, logger);
  } else {
    logger?.info(`Target index [${targetIndex}] already exists — reusing it`);
  }

  const response = await client.reindex({
    body: {
      source: {
        index: sourceIndex,
        size: batchSize,
      },
      dest: {
        index: targetIndex,
      },
    },
    refresh: true,
    wait_for_completion: true,
  });

  // The SDK types the reindex response too narrowly when
  // wait_for_completion=true; created/updated/failures are present at runtime.
  const body = response.body as unknown as {
    created?: number;
    updated?: number;
    failures?: unknown[];
  };

  const created = body.created ?? 0;
  const updated = body.updated ?? 0;
  const failures = body.failures ?? [];

  let aliasSwapped = false;
  if (recreateAlias && aliasName) {
    await pointAliasToIndex(client, targetIndex, aliasName, logger);
    aliasSwapped = true;
  }

  const result: ReindexResult = {
    sourceIndex,
    targetIndex,
    aliasName: aliasSwapped ? aliasName : undefined,
    created,
    updated,
    total: created + updated,
    failures,
    aliasSwapped,
    took: Date.now() - startTime,
  };

  logger?.info(`Reindex finished for [${targetIndex}]`, {
    total: result.total,
    failures: failures.length,
    aliasSwapped,
  });

  return result;
}
