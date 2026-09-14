/**
 * OpenSearch client singleton.
 */
import {
  createOpenSearchClient,
  pingOpenSearch,
  type Client,
} from "@repo/opensearch";
import { config } from "../config/config.js";
import { logger } from "../observability/metrics.js";

let _client: Client | null = null;

export function getOpenSearchClient(): Client {
  if (!_client) {
    logger.info(`Initializing OpenSearch client → ${config.opensearch.node}`);
    _client = createOpenSearchClient({
      node: config.opensearch.node,
      auth: config.opensearch.auth,
      maxRetries: config.opensearch.maxRetries,
      requestTimeout: config.opensearch.requestTimeout,
      rejectUnauthorized: config.app.isProd,
    });
  }
  return _client;
}

export async function checkOpenSearchConnection(
  client: Client,
): Promise<boolean> {
  return pingOpenSearch(client);
}

export async function closeOpenSearchClient(): Promise<void> {
  if (_client) {
    try {
      await _client.close();
      logger.info("OpenSearch client closed");
    } catch (error) {
      logger.error("Error closing OpenSearch client", { error });
    } finally {
      _client = null;
    }
  }
}
