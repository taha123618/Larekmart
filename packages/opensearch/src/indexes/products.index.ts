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
    logger?.error(`Failed to ensure product index ${indexName} exists`, {
      error,
    });
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
