import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { media } from "./media.js";

/** Upload sessions — presigned upload lifecycle state. */
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    status: text("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("media_uploads_media_idx").on(table.mediaId),
    index("media_uploads_status_expires_idx").on(table.status, table.expiresAt),
  ],
);

export type MediaUploadSelect = typeof mediaUploads.$inferSelect;
export type MediaUploadInsert = typeof mediaUploads.$inferInsert;
