import { getServiceContainer } from "../container.js";
import { env } from "../config/env.js";
import { logger, mediaMetrics } from "../observability/metrics.js";
import { jobTraceFields } from "../observability/tracing.js";
import { shutdown } from "../app.js";
import { producer } from "../utils/kafka.js";

/**
 * media-worker: independent image-processing process (spec sections 17–18).
 *
 * - Claims jobs atomically from PostgreSQL (FOR UPDATE SKIP LOCKED), so any
 *   number of replicas scale horizontally without double-processing.
 * - Retries transient failures up to MEDIA_WORKER_MAX_ATTEMPTS; quarantines
 *   content that is not the declared image type.
 * - No HTTP routing responsibility — this process only processes media.
 */
export function startProcessingWorker(
  pollIntervalMs = env.MEDIA_WORKER_POLL_INTERVAL_MS,
): () => void {
  const container = getServiceContainer();
  const jobs = container.repos.jobs;
  const workerId = `worker-${process.pid}`;
  let running = true;
  let loopPromise: Promise<void> | null = null;

  const tick = async (): Promise<void> => {
    const job = await jobs.claimNextPending(workerId);
    if (!job) return;

    logger.info(
      `Processing job ${job.id} (media ${job.mediaId}, attempt ${job.attempts})`,
      jobTraceFields({
        id: job.id,
        mediaId: job.mediaId,
        jobType: job.jobType,
        attempt: job.attempts,
      }),
    );

    const outcome = await container.processingService.runJob(job, {
      onReady: async (mediaId) => {
        await container.uploadService.markProcessedReady(mediaId);
      },
      onFailed: async (mediaId, error) => {
        await container.uploadService.markProcessingFailed(mediaId, error);
      },
      onQuarantine: async (mediaId, reason) => {
        await container.uploadService.quarantine(mediaId, reason);
      },
    });

    if (outcome === "COMPLETED") {
      await jobs.markCompleted(job.id);
      logger.info(`Job ${job.id} completed for media ${job.mediaId}`);
    } else {
      const decision = await jobs.markFailedOrRetry(
        job.id,
        "Processing attempt failed",
        env.MEDIA_WORKER_MAX_ATTEMPTS,
      );
      mediaMetrics.media_processing_failures_total.inc();
      if (decision === "RETRY") {
        logger.warn(`Job ${job.id} will retry for media ${job.mediaId}`);
      } else {
        logger.error(
          `Job ${job.id} permanently failed for media ${job.mediaId}`,
        );
      }
    }
  };

  const loop = async (): Promise<void> => {
    while (running) {
      try {
        await tick();
      } catch (error) {
        logger.error("Worker tick failed", error);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  };

  loopPromise = loop();
  logger.info(`media-worker started (${workerId}, poll ${pollIntervalMs}ms)`);

  return () => {
    running = false;
    void loopPromise?.then(() => undefined);
  };
}

async function main(): Promise<void> {
  logger.info("Starting media-worker standalone process...");
  try {
    await producer.connect();
  } catch (error) {
    logger.error(
      "Kafka unavailable; worker will publish events once restored",
      error,
    );
  }
  startProcessingWorker();

  process.on("SIGTERM", async () => {
    logger.info("media-worker shutting down...");
    try {
      await producer.disconnect();
    } catch (error) {
      logger.error("Error disconnecting Kafka producer", error);
    }
    await shutdown();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    logger.info("media-worker shutting down...");
    try {
      await producer.disconnect();
    } catch (error) {
      logger.error("Error disconnecting Kafka producer", error);
    }
    await shutdown();
    process.exit(0);
  });
}

// Only run main() when executed directly (not when imported by tests).
if (
  process.argv[1]?.endsWith("processing.worker.ts") ||
  process.argv[1]?.endsWith("processing.worker.js")
) {
  main().catch((error) => {
    logger.fatal("media-worker failed to start", error);
    process.exit(1);
  });
}
