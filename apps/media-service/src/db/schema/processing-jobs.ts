import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { media } from "./media.js";

/** Async processing jobs executed by media-worker (Sharp). */
export const mediaProcessingJobs = pgTable(
  "media_processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("media_jobs_media_idx").on(table.mediaId),
    index("media_jobs_status_created_idx").on(table.status, table.createdAt),
  ],
);

export type MediaProcessingJobSelect = typeof mediaProcessingJobs.$inferSelect;
export type MediaProcessingJobInsert = typeof mediaProcessingJobs.$inferInsert;
