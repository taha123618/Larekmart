import type { SearchProductDocument } from "@repo/types";
import {
  indexProductDocument,
  updateProductDocument,
  deleteProductDocument,
  type Client,
} from "@repo/opensearch";
import { getOpenSearchClient } from "../opensearch/client.js";
import { logger, searchMetrics } from "../observability/metrics.js";

export type DriftOperationType = "UPSERT" | "PARTIAL_UPDATE" | "DELETE";

export interface DriftEntry {
  id: string;
  type: DriftOperationType;
  product?: SearchProductDocument;
  partialDoc?: Partial<SearchProductDocument>;
  timestamp: number;
}

export class DriftReconciler {
  /** Map of active targetIndex -> Set of buffered drift entries */
  private activeTargets = new Map<string, Map<string, DriftEntry>>();
  /** Total count of drift mutations reconciled */
  private reconciledCounts = new Map<string, number>();

  /**
   * Start tracking mutations for a pending target index.
   */
  public registerTarget(targetIndex: string): void {
    if (!this.activeTargets.has(targetIndex)) {
      this.activeTargets.set(targetIndex, new Map());
      this.reconciledCounts.set(targetIndex, 0);
      logger.info(
        `DriftReconciler: Registered active target index [${targetIndex}]`,
      );
    }
  }

  /**
   * Stop tracking mutations for a target index.
   */
  public unregisterTarget(targetIndex: string): void {
    this.activeTargets.delete(targetIndex);
    this.reconciledCounts.delete(targetIndex);
    logger.info(`DriftReconciler: Unregistered target index [${targetIndex}]`);
  }

  /**
   * Returns true if there is at least one active reindex target.
   */
  public hasActiveTargets(): boolean {
    return this.activeTargets.size > 0;
  }

  /**
   * Get total drift reconciled count for a target index.
   */
  public getReconciledCount(targetIndex: string): number {
    return this.reconciledCounts.get(targetIndex) ?? 0;
  }

  /**
   * Intercept a document upsert and dual-write to all active pending targets.
   */
  public async recordUpsert(product: SearchProductDocument): Promise<void> {
    if (!this.hasActiveTargets()) return;

    const docId = String(product.id);
    for (const [targetIndex, buffer] of this.activeTargets.entries()) {
      try {
        await indexProductDocument(
          getOpenSearchClient(),
          product,
          targetIndex,
          logger,
        );
        const currentCount = this.reconciledCounts.get(targetIndex) ?? 0;
        this.reconciledCounts.set(targetIndex, currentCount + 1);
        searchMetrics.indexingDocumentsTotal.inc({
          operation: "drift_upsert",
          status: "success",
        });
      } catch (err: any) {
        logger.warn(
          `DriftReconciler: Live dual-write upsert failed for [${docId}] to [${targetIndex}], buffering for drain: ${err.message}`,
        );
        buffer.set(docId, {
          id: docId,
          type: "UPSERT",
          product,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Intercept a partial update and dual-write to all active pending targets.
   */
  public async recordPartialUpdate(
    id: string | number,
    partialDoc: Partial<SearchProductDocument>,
  ): Promise<void> {
    if (!this.hasActiveTargets()) return;

    const docId = String(id);
    for (const [targetIndex, buffer] of this.activeTargets.entries()) {
      try {
        await updateProductDocument(
          getOpenSearchClient(),
          id,
          partialDoc,
          targetIndex,
          logger,
        );
        const currentCount = this.reconciledCounts.get(targetIndex) ?? 0;
        this.reconciledCounts.set(targetIndex, currentCount + 1);
        searchMetrics.indexingDocumentsTotal.inc({
          operation: "drift_partial_update",
          status: "success",
        });
      } catch (err: any) {
        logger.warn(
          `DriftReconciler: Live dual-write partial update failed for [${docId}] to [${targetIndex}], buffering for drain: ${err.message}`,
        );
        buffer.set(docId, {
          id: docId,
          type: "PARTIAL_UPDATE",
          partialDoc,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Intercept a document delete and dual-write to all active pending targets.
   */
  public async recordDelete(id: string | number): Promise<void> {
    if (!this.hasActiveTargets()) return;

    const docId = String(id);
    for (const [targetIndex, buffer] of this.activeTargets.entries()) {
      try {
        await deleteProductDocument(
          getOpenSearchClient(),
          id,
          targetIndex,
          logger,
        );
        const currentCount = this.reconciledCounts.get(targetIndex) ?? 0;
        this.reconciledCounts.set(targetIndex, currentCount + 1);
        searchMetrics.indexingDocumentsTotal.inc({
          operation: "drift_delete",
          status: "success",
        });
      } catch (err: any) {
        logger.warn(
          `DriftReconciler: Live dual-write delete failed for [${docId}] to [${targetIndex}], buffering for drain: ${err.message}`,
        );
        buffer.set(docId, {
          id: docId,
          type: "DELETE",
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Drains and applies all buffered drift mutations to the target index.
   * Called immediately after native _reindex completes before alias swap.
   */
  public async drainAndApply(
    targetIndex: string,
    client: Client = getOpenSearchClient(),
  ): Promise<number> {
    const buffer = this.activeTargets.get(targetIndex);
    if (!buffer || buffer.size === 0) {
      return 0;
    }

    logger.info(
      `DriftReconciler: Draining ${buffer.size} buffered drift events to [${targetIndex}]`,
    );

    let drainedCount = 0;
    for (const [docId, entry] of buffer.entries()) {
      try {
        if (entry.type === "UPSERT" && entry.product) {
          await indexProductDocument(
            client,
            entry.product,
            targetIndex,
            logger,
          );
        } else if (entry.type === "PARTIAL_UPDATE" && entry.partialDoc) {
          await updateProductDocument(
            client,
            docId,
            entry.partialDoc,
            targetIndex,
            logger,
          );
        } else if (entry.type === "DELETE") {
          await deleteProductDocument(client, docId, targetIndex, logger);
        }
        drainedCount++;
      } catch (err: any) {
        logger.error(
          `DriftReconciler: Failed applying buffered drift mutation [${docId}] to [${targetIndex}]: ${err.message}`,
        );
      }
    }

    buffer.clear();
    const currentCount = this.reconciledCounts.get(targetIndex) ?? 0;
    this.reconciledCounts.set(targetIndex, currentCount + drainedCount);

    logger.info(
      `DriftReconciler: Successfully drained ${drainedCount} drift events to [${targetIndex}]`,
    );
    return drainedCount;
  }
}

export const driftReconciler = new DriftReconciler();
