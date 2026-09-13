/**
 * OpenSearch client singleton for product-service.
 *
 * product-service owns product writes in PostgreSQL; this client gives it a
 * read path into the shared product search index through @repo/opensearch,
 * so catalog endpoints can serve search/facets without duplicating query DSL.
 *
 * Configuration comes from the same OPENSEARCH_* env vars search-service uses.
 */
import { createOpenSearchClient, pingOpenSearch } from "@repo/opensearch";
import type { Client } from "@repo/opensearch";

/** Read alias for the product search index. */
export const OPENSEARCH_ALIAS = process.env.OPENSEARCH_ALIAS ?? "products";

let _client: Client | null = null;

/** Returns the product-service OpenSearch singleton, creating it on first call. */
export function getOpenSearchClient(): Client {
  if (!_client) {
    const username = process.env.OPENSEARCH_USERNAME;
    const password = process.env.OPENSEARCH_PASSWORD;

    _client = createOpenSearchClient({
      node: process.env.OPENSEARCH_NODE ?? "http://localhost:9200",
      auth: username && password ? { username, password } : undefined,
      requestTimeout: Number(process.env.OPENSEARCH_REQUEST_TIMEOUT ?? 5000),
      rejectUnauthorized: process.env.NODE_ENV === "production",
    });
  }
  return _client;
}

/** Pings the cluster; returns true if reachable. */
export async function checkOpenSearchConnection(): Promise<boolean> {
  return pingOpenSearch(getOpenSearchClient());
}
