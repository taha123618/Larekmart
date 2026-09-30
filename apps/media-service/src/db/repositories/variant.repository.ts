import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import type { MediaDb } from "../client.js";
import { mediaVariants } from "../schema/index.js";

export type MediaVariantRow = typeof mediaVariants.$inferSelect;
export type MediaVariantInsert = typeof mediaVariants.$inferInsert;

export const createVariantRepository = (database: MediaDb = db) => ({
  async listByMediaId(mediaId: string): Promise<MediaVariantRow[]> {
    return database
      .select()
      .from(mediaVariants)
      .where(eq(mediaVariants.mediaId, mediaId));
  },

  async upsert(values: MediaVariantInsert): Promise<MediaVariantRow> {
    const rows = await database
      .insert(mediaVariants)
      .values(values)
      .onConflictDoUpdate({
        target: [mediaVariants.mediaId, mediaVariants.variant],
        set: {
          bucket: values.bucket,
          objectKey: values.objectKey,
          mimeType: values.mimeType,
          width: values.width ?? null,
          height: values.height ?? null,
          sizeBytes: values.sizeBytes,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("variant upsert returned no rows");
    return row;
  },

  async deleteForMedia(mediaId: string): Promise<void> {
    await database
      .delete(mediaVariants)
      .where(eq(mediaVariants.mediaId, mediaId));
  },

  async findByMediaAndVariant(
    mediaId: string,
    variant: string,
  ): Promise<MediaVariantRow | null> {
    const rows = await database
      .select()
      .from(mediaVariants)
      .where(
        and(
          eq(mediaVariants.mediaId, mediaId),
          eq(mediaVariants.variant, variant),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },
});
