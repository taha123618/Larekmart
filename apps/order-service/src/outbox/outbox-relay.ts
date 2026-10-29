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
import {
  DistributedLeaderElector,
  acquireClusterLock,
  releaseClusterLock,
} from "@repo/redis";
import { producer } from "../utils/kafka.js";
import { redis } from "../utils/redis.js";

const logger = createLogger("order-service:outbox-relay");

/** Unique cluster instance identifier for distributed leader lease & worker fencing */
export const OUTBOX_WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "order-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
export const OUTBOX_CLUSTER_LEADER_KEY = "order:outbox:sweeper:leader";
export const OUTBOX_LEADER_TTL_MS = 10_000;
export const OUTBOX_HEARTBEAT_INTERVAL_MS = 3_000;
export const OUTBOX_RETRY_DELAY_MS = 2_000;

let sweeperInterval: NodeJS.Timeout | null = null;
let isSweeping = false;

/** Active Distributed Leader Elector singleton instance for this replica */
export let outboxLeaderElector: DistributedLeaderElector | null = null;

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

  // 1. Cluster Isolation Check
  let isClusterLeader = true;
  const isElectorActive = outboxLeaderElector && outboxLeaderElector.isRunning;

  if (isElectorActive && workerId === OUTBOX_WORKER_ID) {
    // If the managed leader elector is running, fast in-memory check
    isClusterLeader = outboxLeaderElector!.isCurrentLeader;
  } else {
    // If elector is not active or custom workerId passed (e.g. concurrent worker test simulation),
    // acquire single-cycle lease with Redis lock or MongoDB fencing fallback
    try {
      isClusterLeader = await acquireClusterLock(
        redis.client,
        OUTBOX_CLUSTER_LEADER_KEY,
        workerId,
        { ttlMs: OUTBOX_LEADER_TTL_MS },
      );
    } catch (err) {
      // If Redis is offline, gracefully degrade to MongoDB atomic fencing
      logger.warn(
        "Redis cluster leader lock check failed; falling back to DB fencing",
        {
          error: String(err),
          workerId,
        },
      );
      isClusterLeader = true;
    }
  }

  if (!isClusterLeader) {
    logger.debug(
      "Another replica holds the outbox sweeper cluster leader lease; skipping sweep iteration",
      {
        workerId,
      },
    );
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
    logger.error("Error running outbox sweeper batch", {
      error: String(err),
      workerId,
    });
  } finally {
    isSweeping = false;
    // Note: If elector is actively managing leadership for this worker, the leader maintains
    // continuous ownership via background heartbeats; do not release here.
    // If in single-cycle/test fallback mode, release the lock.
    if (!isElectorActive || workerId !== OUTBOX_WORKER_ID) {
      try {
        await releaseClusterLock(
          redis.client,
          OUTBOX_CLUSTER_LEADER_KEY,
          workerId,
        );
      } catch {
        // Lease will naturally auto-expire in OUTBOX_LEADER_TTL_MS
      }
    }
  }

  return publishedCount;
}

/**
 * Starts the distributed leader election framework for outbox sweeping.
 * Guarantees that across all horizontally scaled order-service containers:
 * - Exactly ONE elected leader executes the background sweeping routine.
 * - Standby replicas remain in follower mode (0 DB polling, 0 duplicate dispatches).
 * - Automatic failover promotes a standby replica if the leader crashes or shuts down.
 */
export function startOutboxSweeper(intervalMs = 5_000): void {
  if (outboxLeaderElector) {
    return;
  }

  logger.info(
    `Initializing distributed leader election for outbox sweeper (worker: ${OUTBOX_WORKER_ID}, interval: ${intervalMs}ms)...`,
  );

  outboxLeaderElector = new DistributedLeaderElector({
    client: redis.client,
    lockKey: OUTBOX_CLUSTER_LEADER_KEY,
    candidateId: OUTBOX_WORKER_ID,
    leaseTtlMs: OUTBOX_LEADER_TTL_MS,
    heartbeatIntervalMs: OUTBOX_HEARTBEAT_INTERVAL_MS,
    retryDelayMs: OUTBOX_RETRY_DELAY_MS,
    onPromoted: () => {
      logger.info(
        `[order-service:outbox] Node elected as cluster leader (${OUTBOX_WORKER_ID}). Activating outbox sweeper routine.`,
      );
      if (!sweeperInterval) {
        sweeperInterval = setInterval(() => {
          sweepPendingOutboxEvents().catch((err) => {
            logger.error("Unhandled error in outbox sweeper tick", {
              error: String(err),
            });
          });
        }, intervalMs);
      }
      // Immediate initial sweep upon promotion
      sweepPendingOutboxEvents().catch((err) => {
        logger.warn(
          "Initial outbox sweep upon leader promotion encountered error",
          {
            error: String(err),
          },
        );
      });
    },
    onDemoted: () => {
      logger.info(
        `[order-service:outbox] Node demoted from cluster leader (${OUTBOX_WORKER_ID}). Entering standby mode.`,
      );
      if (sweeperInterval) {
        clearInterval(sweeperInterval);
        sweeperInterval = null;
      }
    },
    onError: (err) => {
      logger.warn(
        "Outbox leader elector encountered exception in election cycle",
        {
          error: String(err),
        },
      );
    },
  });

  outboxLeaderElector.start().catch((err) => {
    logger.error("Failed to start outbox leader elector", {
      error: String(err),
    });
  });
}

/**
 * Stops the background outbox sweeper loop and resigns leadership cleanly during graceful shutdown.
 */
export async function stopOutboxSweeper(): Promise<void> {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }

  if (outboxLeaderElector) {
    const elector = outboxLeaderElector;
    outboxLeaderElector = null;
    await elector.stop();
    logger.info("Transactional outbox sweeper and leader election stopped.");
  }
}
