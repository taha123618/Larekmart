import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  wishlists,
  wishlistEvents,
  type wishlists as WishlistsTable,
} from "../db/schema.js";
import type {
  Wishlist,
  WishlistVisibility,
  WishlistEventType,
} from "@repo/types";

export class WishlistRepository {
  async findById(id: string): Promise<Wishlist | null> {
    const rows = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.id, id))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapWishlist(rows[0]);
  }

  async findByUserId(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ wishlists: Wishlist[]; total: number }> {
    const items = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.isDefault), desc(wishlists.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlists)
      .where(eq(wishlists.userId, userId));

    const total = countResult[0]?.count ?? 0;

    return {
      wishlists: items.map((r) => this.mapWishlist(r)),
      total,
    };
  }

  async findByGuestId(guestId: string): Promise<Wishlist[]> {
    const items = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.guestId, guestId))
      .orderBy(desc(wishlists.createdAt));

    return items.map((r) => this.mapWishlist(r));
  }

  async findDefaultWishlist(userId: string): Promise<Wishlist | null> {
    const rows = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.isDefault, true)))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapWishlist(rows[0]);
  }

  async create(data: {
    userId?: string | null;
    guestId?: string | null;
    name: string;
    isDefault?: boolean;
    visibility?: WishlistVisibility;
  }): Promise<Wishlist> {
    const [row] = await db
      .insert(wishlists)
      .values({
        userId: data.userId || null,
        guestId: data.guestId || null,
        name: data.name,
        isDefault: data.isDefault ?? false,
        visibility: data.visibility ?? "PRIVATE",
      })
      .returning();

    if (!row) throw new Error("Failed to create wishlist record");
    return this.mapWishlist(row);
  }

  async unsetOtherDefaults(userId: string, exceptId?: string): Promise<void> {
    const condition = exceptId
      ? and(
          eq(wishlists.userId, userId),
          sql`${wishlists.id} != ${exceptId}::uuid`,
        )
      : eq(wishlists.userId, userId);

    await db
      .update(wishlists)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(condition);
  }

  async update(
    id: string,
    data: {
      name?: string;
      visibility?: WishlistVisibility;
      isDefault?: boolean;
      userId?: string | null;
      guestId?: string | null;
    },
  ): Promise<Wishlist | null> {
    const [row] = await db
      .update(wishlists)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(wishlists.id, id))
      .returning();

    if (!row) return null;
    return this.mapWishlist(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(wishlists).where(eq(wishlists.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await db
      .delete(wishlists)
      .where(eq(wishlists.userId, userId));
    return result.rowCount ?? 0;
  }

  async logEvent(data: {
    wishlistId: string;
    eventType: WishlistEventType;
    actorId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(wishlistEvents).values({
      wishlistId: data.wishlistId,
      eventType: data.eventType,
      actorId: data.actorId,
      payload: data.payload ?? {},
    });
  }

  private mapWishlist(row: typeof WishlistsTable.$inferSelect): Wishlist {
    return {
      id: row.id,
      userId: row.userId,
      guestId: row.guestId,
      name: row.name,
      isDefault: row.isDefault,
      visibility: row.visibility as WishlistVisibility,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const wishlistRepository = new WishlistRepository();
