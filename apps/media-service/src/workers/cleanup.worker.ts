import { getServiceContainer } from "../container.js";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";
import { shutdown } from "../app.js";
import { CleanupService } from "../services/cleanup.service.js";

/**
 * Cleanup / garbage-collection worker (spec section 32).
 * All jobs are idempotent: they derive from durable state (expired sessions,
 * tombstoned rows, stale job claims, orphaned objects) and tolerate re-runs.
 */
export async function runCleanupSweep(): Promise<{
  expiredSessions: number;
  requeuedJobs: number;
  expiredMediaMarked: number;
  purgedMedia: number;
}> {
  const container = getServiceContainer();
  const cleanupService =
    container.cleanupService ??
    new CleanupService(container.storage, container.repos as never);
  return cleanupService.runSweep();
}

/** Starts the periodic cleanup loop. Returns a stop function. */
export function startCleanupWorker(
  intervalMs = env.MEDIA_CLEANUP_INTERVAL_MS,
): () => void {
  let running = true;
  let inFlight = false;

  const loop = async (): Promise<void> => {
    while (running) {
      if (!inFlight) {
        inFlight = true;
        try {
          await runCleanupSweep();
        } catch (error) {
          logger.error("Cleanup sweep failed", error);
        } finally {
          inFlight = false;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  void loop();
  logger.info(`cleanup worker started (interval ${intervalMs}ms)`);

  return () => {
    running = false;
  };
}

async function main(): Promise<void> {
  try {
    await import("../utils/kafka.js").then(({ producer }) =>
      producer.connect(),
    );
  } catch (error) {
    logger.error("Kafka unavailable; cleanup will still run", error);
  }
  startCleanupWorker();

  const stop = async (): Promise<void> => {
    logger.info("cleanup worker shutting down...");
    await shutdown();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
}

if (
  process.argv[1]?.endsWith("cleanup.worker.ts") ||
  process.argv[1]?.endsWith("cleanup.worker.js")
) {
  main().catch((error) => {
    logger.fatal("cleanup worker failed to start", error);
    process.exit(1);
  });
}
