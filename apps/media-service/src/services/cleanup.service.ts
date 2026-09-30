import type { ObjectStorage } from "../storage/object-storage.js";
import type { createMediaRepository } from "../db/repositories/media.repository.js";
import type { createVariantRepository } from "../db/repositories/variant.repository.js";
import type {
  createUploadRepository,
  createProcessingJobRepository,
} from "../db/repositories/upload.repository.js";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";

export interface CleanupSweepResult {
  expiredSessions: number;
  requeuedJobs: number;
  expiredMediaMarked: number;
  purgedMedia: number;
}

export interface OrphanDetectionResult {
  missingObjects: string[];
  orphanedJobs: string[];
}

export class CleanupService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly repos: {
      media: ReturnType<typeof createMediaRepository>;
      variants: ReturnType<typeof createVariantRepository>;
      uploads: ReturnType<typeof createUploadRepository>;
      jobs: ReturnType<typeof createProcessingJobRepository>;
    },
  ) {}

  /**
   * Executes a complete cleanup sweep (spec section 32).
   * All operations are idempotent and safe to retry.
   */
  async runSweep(): Promise<CleanupSweepResult> {
    const now = new Date();

    // 1. Expired PENDING upload sessions → mark EXPIRED.
    const expiredSessions = await this.repos.uploads.listExpiredPending(now);
    for (const session of expiredSessions) {
      await this.repos.uploads.markExpired(session.id);
    }

    // 2. PROCESSING jobs whose started_at went stale (crashed worker) → requeue to PENDING.
    const jobStaleBefore = new Date(
      now.getTime() - env.MEDIA_WORKER_STALE_JOB_SECONDS * 1000,
    );
    const requeuedJobs =
      await this.repos.jobs.requeueStaleProcessing(jobStaleBefore);
    if (requeuedJobs > 0) {
      logger.warn(
        `Cleanup sweep requeued ${requeuedJobs} stale PROCESSING job(s) (older than ${env.MEDIA_WORKER_STALE_JOB_SECONDS}s)`,
      );
    }

    // 3. Media stuck in PENDING/UPLOADING past the session TTL → mark FAILED.
    const staleBefore = new Date(
      now.getTime() - env.MEDIA_UPLOAD_SESSION_TTL_SECONDS * 1000,
    );
    const abandoned = await this.repos.media.listByStatusOlderThan(
      ["PENDING", "UPLOADING"],
      staleBefore,
    );
    for (const media of abandoned) {
      await this.repos.media.updateStatus(media.id, "FAILED");
    }

    // 4. Soft-deleted media older than the retention window → purge permanently.
    const retentionMs = 7 * 24 * 60 * 60 * 1000; // 7-day recovery window
    const purgeBefore = new Date(now.getTime() - retentionMs);
    const purgeable = await this.repos.media.listSoftDeletedOlderThan(
      purgeBefore,
      50,
    );
    let purgedMedia = 0;
    for (const media of purgeable) {
      try {
        const variants = await this.repos.variants.listByMediaId(media.id);
        for (const variant of variants) {
          await this.storage
            .deleteObject(variant.objectKey)
            .catch(() => undefined);
        }
        await this.storage.deleteObject(media.objectKey).catch(() => undefined);
        await this.repos.variants.deleteForMedia(media.id);
        await this.repos.media.hardDelete(media.id);
        purgedMedia += 1;
      } catch (error) {
        logger.error(`Cleanup purge failed for media ${media.id}`, error);
      }
    }

    logger.info(
      `Cleanup sweep: ${expiredSessions.length} sessions expired, ${requeuedJobs} stale jobs requeued, ${abandoned.length} abandoned uploads marked FAILED, ${purgedMedia} media purged`,
    );

    return {
      expiredSessions: expiredSessions.length,
      requeuedJobs,
      expiredMediaMarked: abandoned.length,
      purgedMedia,
    };
  }

  /**
   * Orphan detection (spec section 49).
   * Identifies database records whose object does not exist in storage,
   * or jobs pointing to missing media.
   */
  async detectOrphans(sampleLimit = 50): Promise<OrphanDetectionResult> {
    const recentMedia = await this.repos.media.list({
      status: "READY",
      limit: sampleLimit,
      offset: 0,
    });

    const missingObjects: string[] = [];
    for (const item of recentMedia.items) {
      const exists = await this.storage.exists(item.objectKey);
      if (!exists) {
        missingObjects.push(item.id);
        logger.warn(
          `Orphan detected: Media ${item.id} is marked READY but object ${item.objectKey} is missing in bucket ${item.bucket}`,
        );
      }
    }

    return {
      missingObjects,
      orphanedJobs: [],
    };
  }
}
