import os from "node:os";
import { randomUUID } from "node:crypto";
import { createLogger } from "@repo/monitoring";
import {
  createOutboxEvent,
  claimPendingOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
  type OutboxEventDocument,
  type mongoose,
} from "@repo/order-db";
import { acquireClusterLock, releaseClusterLock } from "@repo/redis";
import { producer } from "../utils/kafka.js";
import { redis } from "../utils/redis.js";

const logger = createLogger("order-service:outbox-relay");

/** Unique cluster instance identifier for distributed leader lease & worker fencing */
export const OUTBOX_WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "order-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
export const OUTBOX_CLUSTER_LEADER_KEY = "order:outbox:sweeper:leader";
export const OUTBOX_LEADER_TTL_MS = 4500;

let sweeperInterval: NodeJS.Timeout | null = null;
let isSweeping = false;

/**
 * Optimistically publishes a claimed outbox event to Kafka with worker fencing.
 */
export async function publishOutboxEvent(
  event: OutboxEventDocument,
  workerId = OUTBOX_WORKER_ID,
): Promise<boolean> {
  try {
    await producer.send(event.topic, {
      value: event.payload,
    });
    await markOutboxPublished(event._id, workerId);
    logger.debug(`Outbox event published to Kafka`, {
      id: event._id.toString(),
      topic: event.topic,
      workerId,
    });
    return true;
  } catch (err) {
    logger.warn(`Failed to publish outbox event to Kafka`, {
      id: event._id.toString(),
      topic: event.topic,
      workerId,
      error: String(err),
    });
    await markOutboxFailed(event._id, err, 5_000, workerId);
    return false;
  }
}

/**
 * Transactional event dispatch: writes to the outbox table within the database transaction,
 * then triggers non-blocking immediate publishing on the fast path.
 */
export async function dispatchViaOutbox(
  topic: string,
  payload: Record<string, unknown>,
  options?: { session?: mongoose.ClientSession },
): Promise<OutboxEventDocument> {
  const event = await createOutboxEvent(topic, payload, options);
  logger.info(`Outbox event created for topic: ${topic}`, {
    id: event._id.toString(),
    topic,
  });

  // Fast path: if no active transaction session, attempt immediate publish
  if (!options?.session) {
    try {
      await publishOutboxEvent(event);
    } catch (err) {
      logger.warn(`Immediate outbox dispatch failed; queued for sweeper`, {
        id: event._id.toString(),
        topic,
        error: String(err),
      });
    }
  } else {
    // If inside an uncommitted session, defer publish until post-commit event loop tick
    setImmediate(async () => {
      try {
        await publishOutboxEvent(event);
      } catch (err) {
        logger.warn(`Deferred outbox dispatch failed; queued for sweeper`, {
          id: event._id.toString(),
          topic,
          error: String(err),
        });
      }
    });
  }

  return event;
}

/**
 * Sweeper iteration: claims pending or lease-expired outbox events and dispatches them to Kafka.
 * Enforces distributed cluster isolation via Redis leader election lease so that only ONE
 * replica across the entire cluster executes the sweep cycle, eliminating duplicate message dispatches.
 */
export async function sweepPendingOutboxEvents(
  batchSize = 20,
  workerId = OUTBOX_WORKER_ID,
): Promise<number> {
  if (isSweeping) {
    return 0;
  }

  // 1. Cluster Isolation: Attempt to acquire distributed leader lease in Redis
  let isClusterLeader = true;
  try {
    isClusterLeader = await acquireClusterLock(
      redis.client,
      OUTBOX_CLUSTER_LEADER_KEY,
      workerId,
      { ttlMs: OUTBOX_LEADER_TTL_MS },
    );
  } catch (err) {
    // If Redis is offline, gracefully degrade to MongoDB atomic fencing
    logger.warn("Redis cluster leader lock check failed; falling back to DB fencing", {
      error: String(err),
      workerId,
    });
    isClusterLeader = true;
  }

  if (!isClusterLeader) {
    logger.debug("Another replica holds the outbox sweeper cluster leader lease; skipping sweep iteration", {
      workerId,
    });
    return 0;
  }

  isSweeping = true;
  let publishedCount = 0;

  try {
    // 2. Claim pending events with atomic worker fencing
    const events = await claimPendingOutboxEvents(batchSize, 30_000, workerId);
    if (events.length > 0) {
      logger.info(`Outbox sweeper claimed ${events.length} pending events`, {
        workerId,
      });
    }

    for (const event of events) {
      const ok = await publishOutboxEvent(event, workerId);
      if (ok) {
        publishedCount++;
      }
    }
  } catch (err) {
    logger.error("Error running outbox sweeper batch", { error: String(err), workerId });
  } finally {
    isSweeping = false;
    // Release cluster lock so next tick can be claimed promptly or by another replica
    try {
      await releaseClusterLock(redis.client, OUTBOX_CLUSTER_LEADER_KEY, workerId);
    } catch {
      // Lease will naturally auto-expire in OUTBOX_LEADER_TTL_MS
    }
  }

  return publishedCount;
}

/**
 * Starts the resilient background sweeper loop (default: every 5 seconds).
 * Adds staggered jitter across horizontal replicas to desynchronize polling ticks.
 */
export function startOutboxSweeper(intervalMs = 5_000): void {
  if (sweeperInterval) {
    return;
  }

  // Add slight random jitter (±300ms) to desynchronize cluster instances
  const jitterMs = Math.floor(Math.random() * 600) - 300;
  const effectiveIntervalMs = Math.max(2000, intervalMs + jitterMs);

  logger.info(
    `Starting transactional outbox sweeper (interval: ${effectiveIntervalMs}ms, worker: ${OUTBOX_WORKER_ID})...`,
  );

  sweeperInterval = setInterval(() => {
    sweepPendingOutboxEvents().catch((err) => {
      logger.error("Unhandled error in outbox sweeper tick", {
        error: String(err),
      });
    });
  }, effectiveIntervalMs);

  // Trigger immediate initial sweep with slight delay to allow cluster initialization
  setTimeout(() => {
    sweepPendingOutboxEvents().catch((err) => {
      logger.warn("Initial outbox sweep encountered error", {
        error: String(err),
      });
    });
  }, 1000);
}

/**
 * Stops the background outbox sweeper loop during graceful shutdown.
 */
export function stopOutboxSweeper(): void {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
    logger.info("Transactional outbox sweeper stopped.");
  }
}
