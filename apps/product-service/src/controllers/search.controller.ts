import { Request, Response } from "express";
import { createLogger, measureAsync } from "@repo/monitoring";
import {
  searchProductDocuments,
  type ProductSearchResult,
} from "@repo/opensearch";
import { prisma } from "@repo/product-db";
import {
  SearchBackfillRequestSchema,
  SearchQueryParamsSchema,
  type SearchBackfillResponse,
  type SearchProductDocument,
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
 * @repo/opensearch. If OpenSearch is temporarily unavailable, gracefully
 * falls back to querying PostgreSQL via Prisma so storefront discovery
 * never crashes with an unhandled 500 error.
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
  let result: ProductSearchResult<SearchProductDocument>;

  try {
    const searchResult = await measureAsync(
      "opensearch.products.search",
      async () =>
        searchProductDocuments(getOpenSearchClient(), OPENSEARCH_ALIAS, params),
    );
    result = searchResult.result;
    logger.info(
      `Search "${params.q ?? ""}" returned ${result.total} hits from OpenSearch [${OPENSEARCH_ALIAS}]`,
    );
  } catch (error: any) {
    logger.warn(
      `OpenSearch search unavailable (${error?.message || "Connection error"}). Falling back to PostgreSQL/Prisma catalog query.`,
    );

    // Resilient fallback: Query PostgreSQL catalog directly
    const where: any = {};
    if (params.q && params.q.trim().length > 0) {
      where.OR = [
        { name: { contains: params.q.trim(), mode: "insensitive" } },
        { description: { contains: params.q.trim(), mode: "insensitive" } },
      ];
    }
    if (params.category) {
      where.categorySlug = params.category;
    }
    if (params.min_price !== undefined || params.max_price !== undefined) {
      where.price = {};
      if (params.min_price !== undefined) where.price.gte = params.min_price;
      if (params.max_price !== undefined) where.price.lte = params.max_price;
    }

    const orderBy: any = {};
    if (params.sort === "price_asc") {
      orderBy.price = "asc";
    } else if (params.sort === "price_desc") {
      orderBy.price = "desc";
    } else if (params.sort === "oldest") {
      orderBy.createdAt = "asc";
    } else {
      orderBy.createdAt = "desc";
    }

    const skip = (params.page - 1) * params.limit;
    const [dbProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: params.limit,
      }),
      prisma.product.count({ where }),
    ]);

    const fallbackDocs: SearchProductDocument[] = dbProducts.map((p) => ({
      id: String(p.id),
      name: p.name,
      description: p.description || "",
      shortDescription: p.shortDescription || "",
      category: p.categorySlug || "apparel",
      categorySlug: p.categorySlug || "apparel",
      price: p.price,
      sizes: p.sizes || [],
      colors: p.colors || [],
      images: (p.images as Record<string, string>) || {},
      inStock: true,
      isActive: true,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    result = {
      products: fallbackDocs,
      total,
      took: Date.now() - started,
      raw: {} as any,
      facets: {
        categories: [],
        colors: [],
        sizes: [],
        brands: [],
        price_stats: { min: 0, max: 0, avg: 0 },
      },
    };
  }

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
