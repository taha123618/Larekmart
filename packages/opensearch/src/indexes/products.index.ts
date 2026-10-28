import type { Client } from "@opensearch-project/opensearch";
import { PRODUCT_INDEX_SETTINGS } from "./product-mappings.js";
import type { Logger } from "@repo/monitoring";

/**
 * Ensures the product index and its alias exist in OpenSearch.
 * Creates the index and points the alias if missing.
 *
 * @param client   - An OpenSearch client instance
 * @param indexName - Concrete versioned index name (e.g. "products-v1")
 * @param aliasName - Read alias (e.g. "products")
 * @param logger   - Optional structured logger
 */
export async function ensureProductIndexExists(
  client: Client,
  indexName: string,
  aliasName: string,
  logger?: Logger,
): Promise<void> {
  try {
    const existsResponse = await client.indices.exists({ index: indexName });
    const exists = existsResponse.body;

    if (!exists) {
      logger?.info(`Creating OpenSearch index: ${indexName}`);
      await client.indices.create({
        index: indexName,
        body: PRODUCT_INDEX_SETTINGS as any, // SDK Property type is overly strict
      });

      await pointAliasToIndex(client, indexName, aliasName, logger);
      logger?.info(
        `Index ${indexName} created and alias ${aliasName} pointed to it`,
      );
    } else {
      logger?.info(`OpenSearch index ${indexName} already exists`);

      const aliasExists = await client.indices.existsAlias({
        name: aliasName,
        index: indexName,
      });

      if (!aliasExists.body) {
        await pointAliasToIndex(client, indexName, aliasName, logger);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to ensure product index ${indexName} exists`,
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * Atomically swaps an alias to point at a new index.
 * Removes the alias from all previous indices first.
 */
export async function pointAliasToIndex(
  client: Client,
  indexName: string,
  aliasName: string,
  logger?: Logger,
): Promise<void> {
  try {
    const aliasResponse = await client.indices.getAlias(
      { name: aliasName },
      { ignore: [404] },
    );

    const actions: any[] = [];

    if (aliasResponse.body && aliasResponse.statusCode !== 404) {
      const existingIndices = Object.keys(aliasResponse.body);
      for (const idx of existingIndices) {
        actions.push({ remove: { index: idx, alias: aliasName } });
      }
    }

    actions.push({ add: { index: indexName, alias: aliasName } });

    await client.indices.updateAliases({ body: { actions } });
    logger?.info(`Alias [${aliasName}] now points to [${indexName}]`);
  } catch (error) {
    logger?.error(`Failed to point alias ${aliasName} to ${indexName}`, {
      error,
    });
    throw error;
  }
}

/**
 * Creates a new versioned index (e.g. "products-v1737000000000") with the
 * current product mappings. Used as the first step in a zero-downtime reindex.
 */
export async function createNewVersionedIndex(
  client: Client,
  versionedIndexName: string,
  logger?: Logger,
): Promise<void> {
  logger?.info(`Creating new versioned index: ${versionedIndexName}`);
  await client.indices.create({
    index: versionedIndexName,
    body: PRODUCT_INDEX_SETTINGS as any,
  });
}

/**
 * Atomically swaps an alias from an old index to a new target index.
 * Optionally deletes the previous index if deleteOldIndex is true.
 */
export async function atomicAliasSwap(
  client: Client,
  options: {
    aliasName: string;
    newIndex: string;
    oldIndex?: string;
    deleteOldIndex?: boolean;
  },
  logger?: Logger,
): Promise<{ previousIndex: string | null; newIndex: string }> {
  const { aliasName, newIndex, deleteOldIndex = false } = options;

  try {
    const aliasResponse = await client.indices.getAlias(
      { name: aliasName },
      { ignore: [404] },
    );

    const actions: any[] = [];
    let previousIndex: string | null = options.oldIndex ?? null;

    if (aliasResponse.body && aliasResponse.statusCode !== 404) {
      const existingIndices = Object.keys(aliasResponse.body);
      if (existingIndices.length > 0 && !previousIndex) {
        previousIndex = existingIndices[0] ?? null;
      }
      for (const idx of existingIndices) {
        actions.push({ remove: { index: idx, alias: aliasName } });
      }
    }

    actions.push({ add: { index: newIndex, alias: aliasName } });

    await client.indices.updateAliases({ body: { actions } });
    logger?.info(
      `Atomic alias swap complete: [${aliasName}] now points to [${newIndex}] (was: [${previousIndex ?? "none"}])`,
    );

    if (deleteOldIndex && previousIndex && previousIndex !== newIndex) {
      logger?.info(`Deleting decommissioned index: [${previousIndex}]`);
      await client.indices.delete({ index: previousIndex }, { ignore: [404] });
    }

    return { previousIndex, newIndex };
  } catch (error) {
    logger?.error(
      `Atomic alias swap failed for alias [${aliasName}] to [${newIndex}]`,
      {
        error,
      },
    );
    throw error;
  }
}

/**
 * Retrieves the topology of indices associated with an alias, identifying
 * the current active index and historical/retained versions.
 */
export async function getAliasTopology(
  client: Client,
  aliasName: string,
  logger?: Logger,
): Promise<{
  aliasName: string;
  currentIndex: string | null;
  allIndices: string[];
  retainedIndices: string[];
}> {
  try {
    const [aliasRes, indicesRes] = await Promise.all([
      client.indices.getAlias({ name: aliasName }, { ignore: [404] }),
      client.cat.indices({ format: "json" }),
    ]);

    let currentIndex: string | null = null;
    if (aliasRes.body && aliasRes.statusCode !== 404) {
      const active = Object.keys(aliasRes.body);
      currentIndex = active[0] ?? null;
    }

    const catList = Array.isArray(indicesRes.body)
      ? (indicesRes.body as Array<{ index: string }>)
      : [];
    const allMatching = catList
      .map((entry) => entry.index)
      .filter(
        (name) => name.startsWith(`${aliasName}-v`) || name === aliasName,
      );

    const retainedIndices = allMatching.filter(
      (idx) => idx !== currentIndex && idx !== aliasName,
    );

    return {
      aliasName,
      currentIndex,
      allIndices: allMatching,
      retainedIndices,
    };
  } catch (error) {
    logger?.error(`Failed to retrieve alias topology for [${aliasName}]`, {
      error,
    });
    return {
      aliasName,
      currentIndex: null,
      allIndices: [],
      retainedIndices: [],
    };
  }
}

/**
 * Verifies document count parity and search query sanity between source and target indices.
 */
export async function verifyIndexParity(
  client: Client,
  sourceIndex: string,
  targetIndex: string,
  logger?: Logger,
  toleranceRatio = 0.05,
): Promise<{
  sourceIndex: string;
  targetIndex: string;
  sourceCount: number;
  targetCount: number;
  diff: number;
  isHealthy: boolean;
  sampleSearchOk: boolean;
  reason?: string;
}> {
  try {
    const [srcCountRes, tgtCountRes, searchRes] = await Promise.all([
      client.count({ index: sourceIndex }, { ignore: [404] }),
      client.count({ index: targetIndex }, { ignore: [404] }),
      client.search({
        index: targetIndex,
        size: 1,
        body: { query: { match_all: {} } },
      }),
    ]);

    const sourceCount =
      srcCountRes.body && srcCountRes.statusCode !== 404
        ? (srcCountRes.body.count ?? 0)
        : 0;
    const targetCount =
      tgtCountRes.body && tgtCountRes.statusCode !== 404
        ? (tgtCountRes.body.count ?? 0)
        : 0;
    const sampleSearchOk = (searchRes.statusCode ?? 200) < 400;

    const diff = Math.abs(targetCount - sourceCount);
    const maxAllowedDiff = Math.max(5, Math.ceil(sourceCount * toleranceRatio));
    const isHealthy =
      sampleSearchOk &&
      (sourceCount === 0 || targetCount >= sourceCount - maxAllowedDiff);

    let reason: string | undefined;
    if (!sampleSearchOk) {
      reason = "Sample search query failed on target index";
    } else if (!isHealthy) {
      reason = `Target index count [${targetCount}] is significantly lower than source [${sourceCount}] (diff: ${diff}, max allowed: ${maxAllowedDiff})`;
    }

    logger?.info(
      `Index parity check between [${sourceIndex}] and [${targetIndex}]`,
      {
        sourceCount,
        targetCount,
        isHealthy,
        sampleSearchOk,
        reason,
      },
    );

    return {
      sourceIndex,
      targetIndex,
      sourceCount,
      targetCount,
      diff,
      isHealthy,
      sampleSearchOk,
      reason,
    };
  } catch (error: any) {
    logger?.error(`Error evaluating index parity for [${targetIndex}]`, {
      error: error.message,
    });
    return {
      sourceIndex,
      targetIndex,
      sourceCount: 0,
      targetCount: 0,
      diff: 0,
      isHealthy: false,
      sampleSearchOk: false,
      reason: error.message,
    };
  }
}
