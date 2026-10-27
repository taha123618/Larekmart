import { createLogger } from "@repo/monitoring";
import {
  createOutboxEvent,
  claimPendingOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
  type OutboxEventDocument,
  type mongoose,
} from "@repo/order-db";
import { producer } from "../utils/kafka.js";

const logger = createLogger("order-service:outbox-relay");

let sweeperInterval: NodeJS.Timeout | null = null;
let isSweeping = false;

/**
 * Optimistically publishes a claimed outbox event to Kafka.
 */
export async function publishOutboxEvent(
  event: OutboxEventDocument,
): Promise<boolean> {
  try {
    await producer.send(event.topic, {
      value: event.payload,
    });
    await markOutboxPublished(event._id);
    logger.debug(`Outbox event published to Kafka`, {
      id: event._id.toString(),
      topic: event.topic,
    });
    return true;
  } catch (err) {
    logger.warn(`Failed to publish outbox event to Kafka`, {
      id: event._id.toString(),
      topic: event.topic,
      error: String(err),
    });
    await markOutboxFailed(event._id, err);
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
 */
export async function sweepPendingOutboxEvents(
  batchSize = 20,
): Promise<number> {
  if (isSweeping) {
    return 0;
  }

  isSweeping = true;
  let publishedCount = 0;

  try {
    const events = await claimPendingOutboxEvents(batchSize, 30_000);
    if (events.length > 0) {
      logger.info(`Outbox sweeper claimed ${events.length} pending events`);
    }

    for (const event of events) {
      const ok = await publishOutboxEvent(event);
      if (ok) {
        publishedCount++;
      }
    }
  } catch (err) {
    logger.error("Error running outbox sweeper batch", { error: String(err) });
  } finally {
    isSweeping = false;
  }

  return publishedCount;
}

/**
 * Starts the resilient background sweeper loop (default: every 5 seconds).
 */
export function startOutboxSweeper(intervalMs = 5_000): void {
  if (sweeperInterval) {
    return;
  }

  logger.info(
    `Starting transactional outbox sweeper (interval: ${intervalMs}ms)...`,
  );

  sweeperInterval = setInterval(() => {
    sweepPendingOutboxEvents().catch((err) => {
      logger.error("Unhandled error in outbox sweeper tick", {
        error: String(err),
      });
    });
  }, intervalMs);

  // Trigger immediate sweep on startup to drain backlog
  sweepPendingOutboxEvents().catch((err) => {
    logger.warn("Initial outbox sweep encountered error", {
      error: String(err),
    });
  });
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
