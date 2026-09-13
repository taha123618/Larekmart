import { Client } from "@opensearch-project/opensearch";
import type { OpenSearchClientConfig } from "./types.js";

/**
 * Creates a new OpenSearch client with the provided configuration.
 *
 * Usage:
 * ```ts
 * import { createOpenSearchClient } from "@repo/opensearch";
 *
 * const client = createOpenSearchClient({
 *   node: env.OPENSEARCH_NODE,
 *   auth: { username: env.OPENSEARCH_USERNAME, password: env.OPENSEARCH_PASSWORD },
 *   rejectUnauthorized: isProd,
 * });
 * ```
 *
 * The caller is responsible for managing the client lifecycle (singleton pattern,
 * closing the connection on shutdown, etc.).
 */
export function createOpenSearchClient(cfg: OpenSearchClientConfig): Client {
  return new Client({
    node: cfg.node,
    auth: cfg.auth,
    maxRetries: cfg.maxRetries ?? 3,
    requestTimeout: cfg.requestTimeout ?? 5000,
    ssl: {
      rejectUnauthorized: cfg.rejectUnauthorized ?? false,
    },
  });
}

/**
 * Pings the cluster and returns true if reachable.
 */
export async function pingOpenSearch(client: Client): Promise<boolean> {
  try {
    const response = await client.ping();
    return response.body === true || response.statusCode === 200;
  } catch {
    return false;
  }
}
