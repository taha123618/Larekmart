import {
  reindexProducts,
  atomicAliasSwap,
  getAliasTopology as osGetAliasTopology,
  verifyIndexParity,
} from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import { invalidateSearchCacheNamespace } from "../cache/search-cache.js";
import { driftReconciler } from "./drift-reconciler.js";
import type {
  ReindexRequest,
  ReindexResponse,
  ReindexJobRecord,
  RollbackRequest,
  AliasTopologyResponse,
} from "@repo/types";

export class ReindexService {
  private jobs = new Map<string, ReindexJobRecord>();

  /**
   * Retrieves a job record by ID.
   */
  public getJob(jobId: string): ReindexJobRecord | null {
    return this.jobs.get(jobId) ?? null;
  }

  /**
   * Lists all tracked reindex jobs.
   */
  public listJobs(): ReindexJobRecord[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.startTime - a.startTime,
    );
  }

  /**
   * Initiates an asynchronous zero-downtime blue/green reindex with drift reconciliation.
   */
  public async startReindex(req: ReindexRequest): Promise<ReindexJobRecord> {
    const jobId = `reindex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const targetAlias = config.opensearch.aliasName;
    const newIndexName = req.targetIndex || `products-v${Date.now()}`;
    const sourceIndex = req.sourceIndex || targetAlias;

    const jobRecord: ReindexJobRecord = {
      jobId,
      status: "INITIALIZING",
      sourceIndex,
      targetIndex: newIndexName,
      aliasName: targetAlias,
      batchSize: req.batchSize ?? 500,
      recreateAlias: req.recreateAlias ?? true,
      indexedCount: 0,
      failedCount: 0,
      driftReconciledCount: 0,
      startTime: Date.now(),
    };

    this.jobs.set(jobId, jobRecord);

    // Register target index for live dual-writing / drift buffering
    driftReconciler.registerTarget(newIndexName);

    // Launch background reindex task
    setImmediate(() => {
      this.runReindexWorkflow(jobRecord).catch((err) => {
        logger.error(
          `Reindex background job [${jobId}] encountered fatal error:`,
          {
            error: err.message,
          },
        );
      });
    });

    return jobRecord;
  }

  /**
   * Background workflow executing reindex, drift reconciliation, verification, and alias swap.
   */
  private async runReindexWorkflow(job: ReindexJobRecord): Promise<void> {
    const client = getOpenSearchClient();
    job.status = "COPYING_DOCUMENTS";

    logger.info(
      `Starting background reindex [${job.sourceIndex}] → [${job.targetIndex}] (Job: ${job.jobId})`,
    );

    try {
      // Step 1: Copy documents from source to target
      const reindexResult = await reindexProducts(
        client,
        {
          sourceIndex: job.sourceIndex,
          targetIndex: job.targetIndex,
          aliasName: job.aliasName,
          batchSize: job.batchSize,
          recreateAlias: false, // Alias is swapped only AFTER drift reconciliation
        },
        logger,
      );

      job.indexedCount = reindexResult.total;
      job.failedCount = reindexResult.failures.length;

      // Step 2: Drift Reconciliation - Drain in-flight mutations captured during copy
      job.status = "RECONCILING_DRIFT";
      logger.info(
        `Reindex copy complete. Draining mutation drift to [${job.targetIndex}] (Job: ${job.jobId})`,
      );

      const drainedCount = await driftReconciler.drainAndApply(
        job.targetIndex,
        client,
      );
      job.driftReconciledCount = drainedCount;

      // Step 3: Verification Gate & Atomic Alias Swap
      if (job.recreateAlias) {
        job.status = "SWAPPING_ALIAS";

        const parity = await verifyIndexParity(
          client,
          job.sourceIndex,
          job.targetIndex,
          logger,
        );

        if (!parity.isHealthy) {
          throw new Error(
            `Index parity verification failed: ${parity.reason ?? "Target index count delta exceeded threshold"}`,
          );
        }

        // Execute atomic alias swap (preserving old index for zero-downtime rollback)
        await atomicAliasSwap(
          client,
          {
            aliasName: job.aliasName,
            newIndex: job.targetIndex,
            deleteOldIndex: false,
          },
          logger,
        );
      }

      // Step 4: Finalize & Invalidate Search Cache
      await invalidateSearchCacheNamespace();

      job.status = "COMPLETED";
      job.endTime = Date.now();
      job.durationMs = job.endTime - job.startTime;

      logger.info(
        `Reindex job [${job.jobId}] COMPLETED successfully in ${job.durationMs}ms`,
        {
          targetIndex: job.targetIndex,
          indexedCount: job.indexedCount,
          driftReconciledCount: job.driftReconciledCount,
        },
      );
    } catch (error: any) {
      job.status = "FAILED";
      job.error = error.message;
      job.endTime = Date.now();
      job.durationMs = job.endTime - job.startTime;

      logger.error(`Reindex job [${job.jobId}] FAILED: ${error.message}`, {
        jobId: job.jobId,
        targetIndex: job.targetIndex,
      });
    } finally {
      driftReconciler.unregisterTarget(job.targetIndex);
    }
  }

  /**
   * Synchronous execution wrapper for tests or CLI scripts.
   */
  public async executeReindex(req: ReindexRequest): Promise<ReindexResponse> {
    const job = await this.startReindex(req);

    // Poll until complete or failed (with 30s timeout)
    const timeout = Date.now() + 30_000;
    while (
      job.status !== "COMPLETED" &&
      job.status !== "FAILED" &&
      job.status !== "ABORTED"
    ) {
      if (Date.now() > timeout) {
        return {
          success: false,
          message: `Reindex operation timed out after 30s (Job ID: ${job.jobId})`,
          jobId: job.jobId,
          indexedCount: job.indexedCount,
          failedCount: job.failedCount,
          durationMs: Date.now() - job.startTime,
        };
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    return {
      success: job.status === "COMPLETED",
      message:
        job.status === "COMPLETED"
          ? `Reindexing completed successfully into ${job.targetIndex}`
          : `Reindexing failed: ${job.error}`,
      jobId: job.jobId,
      indexedCount: job.indexedCount,
      failedCount: job.failedCount,
      driftReconciledCount: job.driftReconciledCount,
      newIndexName: job.targetIndex,
      aliasName: job.aliasName,
      durationMs: job.durationMs ?? Date.now() - job.startTime,
    };
  }

  /**
   * Instantaneous 1-click rollback of an alias to a previous versioned index.
   */
  public async rollbackAlias(req: RollbackRequest): Promise<{
    success: boolean;
    previousIndex: string | null;
    newIndex: string;
  }> {
    const client = getOpenSearchClient();
    const aliasName = req.aliasName || config.opensearch.aliasName;

    logger.warn(
      `Initiating alias rollback: [${aliasName}] → [${req.targetIndex}]`,
    );

    const result = await atomicAliasSwap(
      client,
      {
        aliasName,
        newIndex: req.targetIndex,
        deleteOldIndex: false,
      },
      logger,
    );

    await invalidateSearchCacheNamespace();
    return {
      success: true,
      previousIndex: result.previousIndex,
      newIndex: result.newIndex,
    };
  }

  /**
   * Retrieves the current alias topology and retained historical indices.
   */
  public async getAliasTopology(
    aliasName?: string,
  ): Promise<AliasTopologyResponse> {
    const client = getOpenSearchClient();
    const targetAlias = aliasName || config.opensearch.aliasName;
    return osGetAliasTopology(client, targetAlias, logger);
  }
}

export const reindexService = new ReindexService();
