import { prisma } from "@repo/product-db";
import { createLogger } from "@repo/monitoring";
import type { SearchBackfillResult } from "@repo/types";
import { producer } from "../utils/kafka.js";
import { toProductEventPayload } from "./product-payload.js";

const logger = createLogger("product-service:search-backfill");

/** Tuning for {@link backfillSearchIndex}. */
export interface BackfillOptions {
  /** Products fetched per database round-trip. Defaults to 100. */
  batchSize?: number;
  /** Stop after this many products; the whole catalog when omitted. */
  limit?: number;
  /** Start after this product id, to resume an interrupted run. */
  afterId?: number;
  /**
   * Stop once this long has elapsed and report `hasMore` with `nextAfterId`, so
   * a request-triggered run can hand the sweep back to its caller.
   */
  timeBudgetMs?: number;
  /** Report what would be published without producing to Kafka. */
  dryRun?: boolean;
  /**
   * Connect and disconnect the Kafka producer around the run.
   *
   * Defaults to `true` for standalone scripts. Pass `false` when the caller
   * already owns a connected producer — the running service does — otherwise
   * the run would tear down the shared connection on the way out.
   */
  manageProducerConnection?: boolean;
}

/**
 * Republishes every catalog product as a `product.updated` event so
 * search-service rebuilds each document from the full product payload.
 *
 * Documents indexed before `product.created` carried the whole product are
 * missing `images`, `sizes`, and `colors` — and therefore their thumbnails and
 * colour/size facets. Replaying the catalog through the existing Kafka write
 * path heals them without giving search-service a database dependency.
 *
 * `product.updated` is consumed only by search-service, so a full replay has no
 * side effects on other services. The run is idempotent (upsert) and resumable
 * via `afterId`.
 */
export async function backfillSearchIndex(
  options: BackfillOptions = {},
): Promise<SearchBackfillResult> {
  const batchSize = Math.max(1, options.batchSize ?? 100);
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const dryRun = options.dryRun ?? false;
  const manageProducerConnection = options.manageProducerConnection ?? true;
  const deadline =
    options.timeBudgetMs === undefined
      ? Number.POSITIVE_INFINITY
      : Date.now() + options.timeBudgetMs;

  const result = { processed: 0, published: 0, failed: 0 };
  let cursor = options.afterId;
  // Set once the catalog is provably exhausted, so a stopped run reports
  // `hasMore` instead of claiming it finished.
  let exhausted = false;

  if (!dryRun && manageProducerConnection) await producer.connect();

  try {
    while (result.processed < limit && Date.now() < deadline) {
      const take = Math.min(batchSize, limit - result.processed);

      const products = await prisma.product.findMany({
        orderBy: { id: "asc" },
        take,
        ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (products.length === 0) {
        exhausted = true;
        break;
      }

      for (const product of products) {
        result.processed += 1;

        if (dryRun) {
          result.published += 1;
          continue;
        }

        try {
          await producer.send("product.updated", {
            value: toProductEventPayload(product),
          });
          result.published += 1;
        } catch (error: any) {
          // Keep going: one poisoned product must not abandon the backfill.
          result.failed += 1;
          logger.error(
            `Failed to publish product [${product.id}] for reindex`,
            {
              error: error.message,
            },
          );
        }
      }

      const lastProduct = products[products.length - 1];
      if (!lastProduct) {
        exhausted = true;
        break;
      }
      cursor = lastProduct.id;

      logger.info(
        `Search backfill progress: ${result.processed} read, ${result.published} published, ${result.failed} failed`,
      );

      // Short page means the catalog is exhausted.
      if (products.length < take) {
        exhausted = true;
        break;
      }
    }
  } finally {
    if (!dryRun && manageProducerConnection) await producer.disconnect();
  }

  return {
    ...result,
    nextAfterId: exhausted ? undefined : cursor,
    hasMore: !exhausted,
  };
}
