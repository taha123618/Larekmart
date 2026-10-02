import { and, desc, eq, gt, isNull, sql, inArray } from "drizzle-orm";
import type { MediaStatusType } from "@repo/types";
import { db } from "../client.js";
import type { MediaDb } from "../client.js";
import { media } from "../schema/index.js";

export type MediaRow = typeof media.$inferSelect;
export type MediaInsert = typeof media.$inferInsert;

export interface MediaListFilter {
  ownerType?: string;
  ownerId?: string;
  status?: MediaStatusType;
  limit: number;
  offset: number;
}

export interface MediaListResult {
  items: MediaRow[];
  total: number;
}

export const createMediaRepository = (database: MediaDb = db) => ({
  async findById(id: string): Promise<MediaRow | null> {
    const rows = await database
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async findByIdNotDeleted(id: string): Promise<MediaRow | null> {
    const rows = await database
      .select()
      .from(media)
      .where(and(eq(media.id, id), isNull(media.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  },

  async list(filter: MediaListFilter): Promise<MediaListResult> {
    const conditions = [];
    if (filter.ownerType)
      conditions.push(eq(media.ownerType, filter.ownerType));
    if (filter.ownerId) conditions.push(eq(media.ownerId, filter.ownerId));
    if (filter.status) conditions.push(eq(media.status, filter.status));
    conditions.push(isNull(media.deletedAt));

    const where = and(...conditions);

    const items = await database
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);

    const totalRows = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(where);

    return { items, total: totalRows[0]?.count ?? 0 };
  },

  async insert(values: MediaInsert): Promise<MediaRow> {
    const rows = await database.insert(media).values(values).returning();
    const row = rows[0];
    if (!row) throw new Error("media insert returned no rows");
    return row;
  },

  async updateStatus(id: string, status: MediaStatusType): Promise<MediaRow> {
    const rows = await database
      .update(media)
      .set({ status, updatedAt: new Date() })
      .where(eq(media.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`media ${id} not found for status update`);
    return row;
  },

  async updateProcessed(
    id: string,
    values: {
      checksum?: string;
      width?: number | null;
      height?: number | null;
      sizeBytes?: number;
      mimeType?: string;
    },
  ): Promise<MediaRow> {
    const rows = await database
      .update(media)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(media.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`media ${id} not found for processed update`);
    return row;
  },

  async softDelete(id: string): Promise<MediaRow | null> {
    const rows = await database
      .update(media)
      .set({ status: "DELETED", deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(media.id, id), isNull(media.deletedAt)))
      .returning();
    return rows[0] ?? null;
  },

  async restore(id: string): Promise<MediaRow | null> {
    const rows = await database
      .update(media)
      .set({ status: "READY", deletedAt: null, updatedAt: new Date() })
      .where(eq(media.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Finds media soft-deleted longer than `olderThan` for purge jobs. */
  async listSoftDeletedOlderThan(
    olderThan: Date,
    limit = 100,
  ): Promise<MediaRow[]> {
    return database
      .select()
      .from(media)
      .where(
        and(
          sql`${media.deletedAt} IS NOT NULL`,
          sql`${media.deletedAt} < ${olderThan}`,
        ),
      )
      .limit(limit);
  },

  /** Counts metadata rows in non-deleted lifecycle states (orphan detection). */
  async countPendingSince(olderThan: Date): Promise<number> {
    const rows = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(
        and(
          isNull(media.deletedAt),
          sql`${media.createdAt} < ${olderThan}`,
          sql`${media.status} IN ('PENDING','UPLOADING')`,
        ),
      );
    return rows[0]?.count ?? 0;
  },

  async listByStatusOlderThan(
    statuses: string[],
    olderThan: Date,
    limit = 100,
  ): Promise<MediaRow[]> {
    return database
      .select()
      .from(media)
      .where(
        and(
          isNull(media.deletedAt),
          inArray(media.status, statuses as MediaStatusType[]),
          sql`${media.createdAt} < ${olderThan}`,
        ),
      )
      .limit(limit);
  },

  /** Hard delete — used only by the admin purge path after retention. */
  async hardDelete(id: string): Promise<void> {
    await database.delete(media).where(eq(media.id, id));
  },

  /**
   * Reassigns generic ownership (e.g. an admin-uploaded draft becomes
   * product-owned when product-service publishes product.created).
   */
  async updateOwner(
    id: string,
    ownerType: string,
    ownerId: string,
  ): Promise<MediaRow | null> {
    const rows = await database
      .update(media)
      .set({ ownerType, ownerId, updatedAt: new Date() })
      .where(eq(media.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Convenience predicate fragment: media created before `olderThan`, not deleted. */
  createdBefore(olderThan: Date) {
    return and(isNull(media.deletedAt), gt(media.createdAt, olderThan));
  },
});
