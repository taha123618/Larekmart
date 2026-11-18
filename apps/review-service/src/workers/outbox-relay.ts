import os from "node:os";
import { randomUUID } from "node:crypto";
import { eq, asc, lt, and } from "drizzle-orm";
import { withClusterLock } from "@repo/redis";
import { db } from "../db/connection.js";
import { reviewOutbox, type ReviewOutboxEvent } from "../db/schema.js";
import { producer } from "../utils/kafka.js";
import { redis } from "../utils/redis.js";

export const REVIEW_OUTBOX_WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "review-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
export const REVIEW_OUTBOX_CLUSTER_LEADER_KEY = "review:outbox:sweeper:leader";
export const REVIEW_OUTBOX_LEADER_TTL_MS = 10_000;
export const REVIEW_OUTBOX_MAX_RETRIES = 5;

let isSweeping = false;
let lastRetentionPurge = 0;
const RETENTION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 7;

/**
 * Claims and processes a batch of PENDING outbox events with idempotency and retry handling.
 *
 * @param batchSize - Maximum number of pending records to fetch per sweep
 * @returns Number of successfully published events
 */
export async function processReviewOutboxBatch(batchSize = 50): Promise<number> {
  const events = await db
    .select()
    .from(reviewOutbox)
    .where(eq(reviewOutbox.status, "PENDING"))
    .orderBy(asc(reviewOutbox.createdAt))
    .limit(batchSize);

  if (!events || events.length === 0) {
    return 0;
  }

  let publishedCount = 0;

  for (const event of events) {
    try {
      const payload = event.payload as Record<string, unknown>;
      const partitionKey =
        payload?.productId ||
        payload?.reviewId ||
        payload?.id ||
        event.id;

      await producer.send(
        event.topic,
        { value: event.payload },
        partitionKey ? { key: String(partitionKey) } : undefined,
      );

      await db
        .update(reviewOutbox)
        .set({
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviewOutbox.id, event.id));

      publishedCount++;
    } catch (err) {
      const nextRetry = event.retryCount + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.warn("[ReviewOutbox] Failed to publish event to Kafka:", {
        eventId: event.id,
        topic: event.topic,
        retryCount: nextRetry,
        error: errorMessage,
      });

      await db
        .update(reviewOutbox)
        .set({
          retryCount: nextRetry,
          status: nextRetry >= REVIEW_OUTBOX_MAX_RETRIES ? "FAILED" : "PENDING",
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(reviewOutbox.id, event.id));
    }
  }

  // Periodic sliding retention purge: delete PUBLISHED records older than 7 days
  const now = Date.now();
  if (now - lastRetentionPurge > RETENTION_PURGE_INTERVAL_MS) {
    lastRetentionPurge = now;
    try {
      const retentionThreshold = new Date(
        now - RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await db
        .delete(reviewOutbox)
        .where(
          and(
            eq(reviewOutbox.status, "PUBLISHED"),
            lt(reviewOutbox.publishedAt, retentionThreshold),
          ),
        );
    } catch (purgeErr) {
      console.warn("[ReviewOutbox] Error during retention purge:", purgeErr);
    }
  }

  return publishedCount;
}

/**
 * Starts the distributed background relay sweeper.
 * Guarantees single-pod execution using Redis cluster leader locking.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 5000ms)
 * @returns Teardown function to cleanly cancel interval
 */
export function startReviewOutboxRelay(
  intervalMs = Number.parseInt(
    process.env.REVIEW_OUTBOX_POLL_INTERVAL_MS ?? "5000",
    10,
  ),
): () => void {
  if (intervalMs <= 0) {
    console.log("[ReviewOutbox] Background outbox relay sweeper is disabled");
    return () => {};
  }

  console.log(
    `[ReviewOutbox] Starting review outbox relay worker (interval: ${intervalMs}ms)`,
  );

  const sweep = async () => {
    if (isSweeping) return;
    isSweeping = true;
    try {
      await withClusterLock(
        redis.client,
        REVIEW_OUTBOX_CLUSTER_LEADER_KEY,
        REVIEW_OUTBOX_WORKER_ID,
        async () => {
          await processReviewOutboxBatch();
        },
        { ttlMs: REVIEW_OUTBOX_LEADER_TTL_MS },
      );
    } catch (error) {
      console.error("[ReviewOutbox] Error during outbox relay sweep:", error);
    } finally {
      isSweeping = false;
    }
  };

  const timer = setInterval(sweep, intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
