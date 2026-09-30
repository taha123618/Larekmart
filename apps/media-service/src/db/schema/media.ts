import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Media metadata — the persistent source of truth for media objects.
 * Binaries live in S3/MinIO; this table only describes them.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum"),
    width: integer("width"),
    height: integer("height"),
    status: text("status").notNull().default("PENDING"),
    visibility: text("visibility").notNull().default("PUBLIC"),
    /** Upload category (avatar, product-image, review-image, ...) — drives
     *  size limits at request time and variant selection in the worker. */
    category: text("category"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("media_owner_status_idx").on(
      table.ownerType,
      table.ownerId,
      table.status,
    ),
    index("media_created_at_idx").on(table.createdAt),
    index("media_deleted_at_idx").on(table.deletedAt),
  ],
);

export type MediaSelect = typeof media.$inferSelect;
export type MediaInsert = typeof media.$inferInsert;
