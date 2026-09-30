import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db } from "../client.js";
import type { MediaDb } from "../client.js";
import { mediaProcessingJobs, mediaUploads } from "../schema/index.js";

export type MediaUploadRow = typeof mediaUploads.$inferSelect;
export type MediaUploadInsert = typeof mediaUploads.$inferInsert;
export type ProcessingJobRow = typeof mediaProcessingJobs.$inferSelect;
export type ProcessingJobInsert = typeof mediaProcessingJobs.$inferInsert;

/**
 * Atomic job-claim statement (used by claimNextPending). One
 * UPDATE ... subquery; FOR UPDATE SKIP LOCKED prevents two worker replicas
 * from claiming the same job. Exported so tests can assert the claim path
 * keeps matching the (status, created_at) index.
 */
export const CLAIM_NEXT_PENDING_SQL = sql`
  UPDATE media_processing_jobs
  SET status = 'PROCESSING', attempts = attempts + 1,
      started_at = now(), updated_at = now(), error = NULL
  WHERE id = (
    SELECT id FROM media_processing_jobs
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
`;

export const createUploadRepository = (database: MediaDb = db) => ({
  async insert(values: MediaUploadInsert): Promise<MediaUploadRow> {
    const rows = await database.insert(mediaUploads).values(values).returning();
    const row = rows[0];
    if (!row) throw new Error("upload session insert returned no rows");
    return row;
  },

  async findLatestForMedia(mediaId: string): Promise<MediaUploadRow | null> {
    const rows = await database
      .select()
      .from(mediaUploads)
      .where(eq(mediaUploads.mediaId, mediaId))
      .orderBy(sql`created_at DESC`)
      .limit(1);
    return rows[0] ?? null;
  },

  async markCompleted(id: string): Promise<MediaUploadRow | null> {
    const rows = await database
      .update(mediaUploads)
      .set({ status: "COMPLETED", completedAt: new Date() })
      .where(eq(mediaUploads.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async markExpired(id: string): Promise<void> {
    await database
      .update(mediaUploads)
      .set({ status: "EXPIRED" })
      .where(eq(mediaUploads.id, id));
  },

  async markAborted(id: string): Promise<void> {
    await database
      .update(mediaUploads)
      .set({ status: "ABORTED" })
      .where(eq(mediaUploads.id, id));
  },

  async listExpiredPending(now: Date, limit = 100): Promise<MediaUploadRow[]> {
    return database
      .select()
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.status, "PENDING"),
          lt(mediaUploads.expiresAt, now),
        ),
      )
      .limit(limit);
  },
});

export const createProcessingJobRepository = (database: MediaDb = db) => ({
  async insert(values: ProcessingJobInsert): Promise<ProcessingJobRow> {
    const rows = await database
      .insert(mediaProcessingJobs)
      .values(values)
      .returning();
    const row = rows[0];
    if (!row) throw new Error("processing job insert returned no rows");
    return row;
  },

  async findById(id: string): Promise<ProcessingJobRow | null> {
    const rows = await database
      .select()
      .from(mediaProcessingJobs)
      .where(eq(mediaProcessingJobs.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async claimNextPending(workerId: string): Promise<ProcessingJobRow | null> {
    /**
     * Atomic job claim: one UPDATE ... subquery, safe across worker replicas.
     * FOR UPDATE SKIP LOCKED inside the subquery prevents two workers from
     * claiming the same job.
     */
    const result = await database.execute(CLAIM_NEXT_PENDING_SQL);

    const rows = (result as unknown as { rows: ProcessingJobRow[] }).rows;
    const job = rows[0] ?? null;
    if (job) {
      console.log(`[media-worker:${workerId}] claimed job ${job.id}`);
    }
    return job;
  },

  async markCompleted(id: string): Promise<void> {
    await database
      .update(mediaProcessingJobs)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(mediaProcessingJobs.id, id));
  },

  /**
   * Marks a job failed. Attempts were already incremented at claim time; when
   * attempts remain the job returns to PENDING for retry, otherwise it is
   * terminally FAILED.
   */
  async markFailedOrRetry(
    id: string,
    error: string,
    maxAttempts: number,
  ): Promise<"RETRY" | "FAILED"> {
    const rows = await database
      .select()
      .from(mediaProcessingJobs)
      .where(eq(mediaProcessingJobs.id, id))
      .limit(1);
    const job = rows[0];
    if (!job) return "FAILED";

    if (job.attempts < maxAttempts) {
      await database
        .update(mediaProcessingJobs)
        .set({ status: "PENDING", error, updatedAt: new Date() })
        .where(eq(mediaProcessingJobs.id, id));
      return "RETRY";
    }

    await database
      .update(mediaProcessingJobs)
      .set({ status: "FAILED", error, updatedAt: new Date() })
      .where(eq(mediaProcessingJobs.id, id));
    return "FAILED";
  },

  /** Jobs stuck in PROCESSING beyond `staleBefore` (crashed worker recovery). */
  async requeueStaleProcessing(staleBefore: Date): Promise<number> {
    const rows = await database
      .update(mediaProcessingJobs)
      .set({ status: "PENDING", updatedAt: new Date() })
      .where(
        and(
          eq(mediaProcessingJobs.status, "PROCESSING"),
          lt(mediaProcessingJobs.startedAt, staleBefore),
        ),
      )
      .returning({ id: mediaProcessingJobs.id });
    return rows.length;
  },

  async listOldest(asc_order = true, limit = 50): Promise<ProcessingJobRow[]> {
    return database
      .select()
      .from(mediaProcessingJobs)
      .orderBy(
        asc_order ? asc(mediaProcessingJobs.createdAt) : sql`created_at DESC`,
      )
      .limit(limit);
  },
});
