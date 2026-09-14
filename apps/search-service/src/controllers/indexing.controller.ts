import type { FastifyReply, FastifyRequest } from "fastify";
import { reindexService } from "../services/reindex.service.js";
import { indexingService } from "../services/indexing.service.js";
import {
  ReindexRequestSchema,
  UpsertProductSchema,
  PartialUpdateProductSchema,
  BulkIndexRequestSchema,
} from "../schemas/indexing.schema.js";
import { transformProductEventToDocument } from "../consumers/product-events.consumer.js";
import { bulkIndexProducts } from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";

// ── Reindex ──────────────────────────────────────────────────────────────────

export async function reindexHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = ReindexRequestSchema.parse(request.body || {});
  const result = await reindexService.executeReindex(body);
  const statusCode = result.success ? 200 : 500;
  return reply.status(statusCode).send(result);
}

// ── Single-document upsert ───────────────────────────────────────────────────

/**
 * POST /api/v1/index/product
 *
 * Admin endpoint to upsert a single product document directly into the index.
 * Useful for fixing a specific document without triggering a full reindex.
 */
export async function upsertProductHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = UpsertProductSchema.parse(request.body);
  const doc = transformProductEventToDocument(body);

  try {
    await indexingService.indexOrUpdateProduct(doc);
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_upsert",
      status: "success",
    });
    return reply.status(200).send({
      success: true,
      message: `Product [${doc.id}] indexed successfully`,
      id: doc.id,
    });
  } catch (error: any) {
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_upsert",
      status: "error",
    });
    logger.error("Failed to upsert product via HTTP", {
      id: doc.id,
      error: error.message,
    });
    return reply.status(500).send({
      success: false,
      message: `Failed to index product [${doc.id}]: ${error.message}`,
    });
  }
}

// ── Partial update ────────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/index/product/:id
 *
 * Partially updates a product document fields without replacing the whole
 * document. Uses doc_as_upsert, so a missing document is created.
 */
export async function partialUpdateProductHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const partial = PartialUpdateProductSchema.parse(request.body);

  try {
    await indexingService.updateProductPartial(id, partial);
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_partial_update",
      status: "success",
    });
    return reply.status(200).send({
      success: true,
      message: `Product [${id}] partially updated`,
      id,
    });
  } catch (error: any) {
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_partial_update",
      status: "error",
    });
    logger.error("Failed to partial-update product via HTTP", {
      id,
      error: error.message,
    });
    return reply.status(500).send({
      success: false,
      message: `Failed to update product [${id}]: ${error.message}`,
    });
  }
}

// ── Delete document ───────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/index/product/:id
 *
 * Removes a single product document from the index. Missing documents are
 * treated as success (idempotent).
 */
export async function deleteProductDocumentHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  try {
    await indexingService.deleteProduct(id);
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_delete",
      status: "success",
    });
    return reply.status(200).send({
      success: true,
      message: `Product [${id}] removed from index`,
      id,
    });
  } catch (error: any) {
    searchMetrics.indexingDocumentsTotal.inc({
      operation: "http_delete",
      status: "error",
    });
    logger.error("Failed to delete product document via HTTP", {
      id,
      error: error.message,
    });
    return reply.status(500).send({
      success: false,
      message: `Failed to delete product [${id}]: ${error.message}`,
    });
  }
}

// ── Bulk index ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/index/bulk
 *
 * Batch-indexes up to 1000 product documents in one request. Uses the
 * @repo/opensearch `bulkIndexProducts` utility with configurable batch size.
 * Designed for backfill and migration scripts that need low-latency batch writes.
 */
export async function bulkIndexProductsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = BulkIndexRequestSchema.parse(request.body);
  const docs = body.products.map((p) => transformProductEventToDocument(p));
  const indexName = config.opensearch.aliasName;

  try {
    searchMetrics.opensearchRequestsTotal.inc({
      operation: "bulk_index",
      status: "start",
    });
    const result = await bulkIndexProducts(
      getOpenSearchClient(),
      docs,
      indexName,
      body.batchSize,
      logger,
    );

    searchMetrics.indexingDocumentsTotal.inc(
      { operation: "bulk", status: "success" },
      result.indexed,
    );
    if (result.failed > 0) {
      searchMetrics.indexingDocumentsTotal.inc(
        { operation: "bulk", status: "error" },
        result.failed,
      );
    }
    searchMetrics.opensearchRequestsTotal.inc({
      operation: "bulk_index",
      status: "success",
    });

    const statusCode =
      result.failed === 0 ? 200 : result.indexed === 0 ? 500 : 207;
    return reply.status(statusCode).send({
      success: result.failed === 0,
      ...result,
    });
  } catch (error: any) {
    searchMetrics.opensearchRequestsTotal.inc({
      operation: "bulk_index",
      status: "error",
    });
    logger.error("Bulk indexing via HTTP failed", {
      error: error.message,
      count: docs.length,
    });
    return reply.status(500).send({
      success: false,
      message: `Bulk index operation failed: ${error.message}`,
    });
  }
}
