import { getServiceContainer } from "../container.js";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";
import { createUploadRepository } from "../db/repositories/upload.repository.js";
import { createMediaRepository } from "../db/repositories/media.repository.js";
import { db } from "../db/client.js";
import { shutdown } from "../app.js";

/**
 * Cleanup / garbage-collection worker (spec section 32).
 * All jobs are idempotent: they derive from durable state (expired sessions,
 * tombstoned rows, orphaned objects) and tolerate re-runs.
 */
export async function runCleanupSweep(): Promise<{
  expiredSessions: number;
  expiredMediaMarked: number;
  purgedMedia: number;
}> {
  const container = getServiceContainer();
  const uploads = createUploadRepository(db);
  const mediaRepo = createMediaRepository(db);
  const now = new Date();

  // 1. Expired PENDING upload sessions → mark EXPIRED.
  const expiredSessions = await uploads.listExpiredPending(now);
  for (const session of expiredSessions) {
    await uploads.markExpired(session.id);
  }

  // 2. Media stuck in PENDING/UPLOADING past the session TTL → FAILED (the
  //    client never completed the upload) and their session markers expire.
  const staleBefore = new Date(
    now.getTime() - env.MEDIA_UPLOAD_SESSION_TTL_SECONDS * 1000,
  );
  const abandoned = await mediaRepo.listByStatusOlderThan(
    ["PENDING", "UPLOADING"],
    staleBefore,
  );
  for (const media of abandoned) {
    await mediaRepo.updateStatus(media.id, "FAILED");
  }

  // 3. Soft-deleted media older than the retention window → purge binaries
  //    + metadata permanently.
  const retentionMs = 7 * 24 * 60 * 60 * 1000; // 7-day recovery window
  const purgeBefore = new Date(now.getTime() - retentionMs);
  const purgeable = await mediaRepo.listSoftDeletedOlderThan(purgeBefore, 50);
  let purgedMedia = 0;
  for (const media of purgeable) {
    try {
      const variants = await container.repos.variants.listByMediaId(media.id);
      for (const variant of variants) {
        await container.storage
          .deleteObject(variant.objectKey)
          .catch(() => undefined);
      }
      await container.storage
        .deleteObject(media.objectKey)
        .catch(() => undefined);
      await container.repos.variants.deleteForMedia(media.id);
      await mediaRepo.hardDelete(media.id);
      purgedMedia += 1;
    } catch (error) {
      logger.error(`Cleanup purge failed for media ${media.id}`, error);
    }
  }

  logger.info(
    `Cleanup sweep: ${expiredSessions.length} sessions expired, ${abandoned.length} abandoned uploads marked FAILED, ${purgedMedia} media purged`,
  );

  return {
    expiredSessions: expiredSessions.length,
    expiredMediaMarked: abandoned.length,
    purgedMedia,
  };
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
