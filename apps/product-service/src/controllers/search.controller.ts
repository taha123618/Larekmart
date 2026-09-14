import { Request, Response } from "express";
import { createLogger, measureAsync } from "@repo/monitoring";
import { searchProductDocuments } from "@repo/opensearch";
import {
  SearchBackfillRequestSchema,
  SearchQueryParamsSchema,
  type SearchBackfillResponse,
  type SearchQueryParams,
  type SearchResponse,
} from "@repo/types";
import { getOpenSearchClient, OPENSEARCH_ALIAS } from "../search/client.js";
import { backfillSearchIndex } from "../search/backfill.js";

const logger = createLogger("product-service:search");

/**
 * GET /products/search
 *
 * Reads the shared OpenSearch product index using the query DSL from
 * @repo/opensearch. Writes to the index remain owned by search-service via
 * Kafka events; this is a read-only path.
 */
export const searchProducts = async (req: Request, res: Response) => {
  const parsed = SearchQueryParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid search parameters",
      errors: parsed.error.flatten(),
    });
  }

  const params: SearchQueryParams = parsed.data;
  const started = Date.now();

  const { result } = await measureAsync(
    "opensearch.products.search",
    async () =>
      searchProductDocuments(getOpenSearchClient(), OPENSEARCH_ALIAS, params),
  );

  const response: SearchResponse = {
    data: result.products,
    meta: {
      query: params.q,
      page: params.page,
      limit: params.limit,
      total: result.total,
      pages: Math.ceil(result.total / params.limit) || 1,
      took: Date.now() - started,
      fromCache: false,
    },
    facets: result.facets,
  };

  logger.info(
    `Search "${params.q ?? ""}" returned ${result.total} hits from [${OPENSEARCH_ALIAS}]`,
  );

  return res.status(200).json(response);
};

/**
 * POST /products/backfill-search (admin)
 *
 * Republishes catalog products as `product.updated` events so search-service
 * rebuilds index documents that predate the full `product.created` payload —
 * the ones missing images, sizes, and colors, and therefore their thumbnails
 * and color/size facets.
 *
 * Each call is one bounded window: it returns `hasMore` plus `nextAfterId`, and
 * the caller continues until the sweep reports it is done. Nothing is indexed
 * here; the events travel the same Kafka path as normal catalog writes.
 */
export const backfillSearchIndexHandler = async (
  req: Request,
  res: Response,
) => {
  const parsed = SearchBackfillRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid backfill parameters",
      errors: parsed.error.flatten(),
    });
  }

  const started = Date.now();
  const result = await backfillSearchIndex({
    ...parsed.data,
    // This service already owns a connected producer.
    manageProducerConnection: false,
  });

  logger.info(
    `Search backfill window: ${result.processed} read, ${result.published} published, ${result.failed} failed, hasMore=${result.hasMore}`,
  );

  const response: SearchBackfillResponse = {
    ...result,
    durationMs: Date.now() - started,
  };

  return res.status(200).json(response);
};
