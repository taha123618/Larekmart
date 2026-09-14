import type { FastifyPluginAsync } from "fastify";
import {
  reindexHandler,
  upsertProductHandler,
  partialUpdateProductHandler,
  deleteProductDocumentHandler,
  bulkIndexProductsHandler,
} from "../controllers/indexing.controller.js";
import { shouldBeAdmin } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export const indexingRoutes: FastifyPluginAsync = async (fastify) => {
  // Tight limiter for write operations; bulk and reindex are even stricter
  const adminRateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 120,
  });
  const heavyRateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 10,
  });

  // ── Reindex (zero-downtime full reindex via OpenSearch native API) ───────────
  fastify.post(
    "/index/reindex",
    { preHandler: [heavyRateLimiter, shouldBeAdmin] },
    reindexHandler,
  );

  // ── Single-document operations ───────────────────────────────────────────────

  /** Upsert a full product document (replaces the document if it exists). */
  fastify.post(
    "/index/product",
    { preHandler: [adminRateLimiter, shouldBeAdmin] },
    upsertProductHandler,
  );

  /** Partially update a product document (only provided fields are changed). */
  fastify.patch<{ Params: { id: string } }>(
    "/index/product/:id",
    { preHandler: [adminRateLimiter, shouldBeAdmin] },
    partialUpdateProductHandler,
  );

  /** Remove a product document from the index (idempotent — 404 is success). */
  fastify.delete<{ Params: { id: string } }>(
    "/index/product/:id",
    { preHandler: [adminRateLimiter, shouldBeAdmin] },
    deleteProductDocumentHandler,
  );

  // ── Bulk operations ──────────────────────────────────────────────────────────

  /** Batch-index up to 1 000 product documents in one HTTP call. */
  fastify.post(
    "/index/bulk",
    { preHandler: [heavyRateLimiter, shouldBeAdmin] },
    bulkIndexProductsHandler,
  );
};
