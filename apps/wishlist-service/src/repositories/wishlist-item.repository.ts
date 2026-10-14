import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  wishlistItems,
  wishlists,
  type wishlistItems as WishlistItemsTable,
} from "../db/schema.js";
import type { WishlistItem } from "@repo/types";

export class WishlistItemRepository {
  async findById(id: string): Promise<WishlistItem | null> {
    const rows = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.id, id))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapWishlistItem(rows[0]);
  }

  async findByWishlistId(
    wishlistId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: WishlistItem[]; total: number }> {
    const rows = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.wishlistId, wishlistId))
      .orderBy(desc(wishlistItems.priority), desc(wishlistItems.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlistItems)
      .where(eq(wishlistItems.wishlistId, wishlistId));

    return {
      items: rows.map((r) => this.mapWishlistItem(r)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async findExistingItem(
    wishlistId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<WishlistItem | null> {
    const variantCondition = variantId
      ? eq(wishlistItems.variantId, variantId)
      : sql`${wishlistItems.variantId} IS NULL OR ${wishlistItems.variantId} = ''`;

    const rows = await db
      .select()
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.wishlistId, wishlistId),
          eq(wishlistItems.productId, productId),
          variantCondition,
        ),
      )
      .limit(1);

    if (!rows[0]) return null;
    return this.mapWishlistItem(rows[0]);
  }

  async create(data: {
    wishlistId: string;
    productId: string;
    variantId?: string | null;
    addedPrice: number;
    currentPrice?: number | null;
    inStock?: boolean;
    note?: string | null;
    priority?: number;
  }): Promise<WishlistItem> {
    const [row] = await db
      .insert(wishlistItems)
      .values({
        wishlistId: data.wishlistId,
        productId: data.productId,
        variantId: data.variantId || null,
        addedPrice: data.addedPrice.toFixed(2),
        currentPrice:
          data.currentPrice !== undefined && data.currentPrice !== null
            ? data.currentPrice.toFixed(2)
            : data.addedPrice.toFixed(2),
        inStock: data.inStock ?? true,
        note: data.note || null,
        priority: data.priority ?? 0,
      })
      .returning();

    if (!row) throw new Error("Failed to insert wishlist item");
    return this.mapWishlistItem(row);
  }

  async update(
    id: string,
    data: {
      note?: string | null;
      priority?: number;
      currentPrice?: number | null;
      inStock?: boolean;
    },
  ): Promise<WishlistItem | null> {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.note !== undefined) updatePayload.note = data.note;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.currentPrice !== undefined && data.currentPrice !== null) {
      updatePayload.currentPrice = data.currentPrice.toFixed(2);
    }
    if (data.inStock !== undefined) updatePayload.inStock = data.inStock;

    const [row] = await db
      .update(wishlistItems)
      .set(updatePayload)
      .where(eq(wishlistItems.id, id))
      .returning();

    if (!row) return null;
    return this.mapWishlistItem(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(wishlistItems)
      .where(eq(wishlistItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkDelete(wishlistId: string, itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) return 0;

    const result = await db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.wishlistId, wishlistId),
          inArray(wishlistItems.id, itemIds),
        ),
      );

    return result.rowCount ?? 0;
  }

  async moveItem(
    itemId: string,
    targetWishlistId: string,
  ): Promise<WishlistItem | null> {
    const [row] = await db
      .update(wishlistItems)
      .set({
        wishlistId: targetWishlistId,
        updatedAt: new Date(),
      })
      .where(eq(wishlistItems.id, itemId))
      .returning();

    if (!row) return null;
    return this.mapWishlistItem(row);
  }

  async findItemsWithProduct(
    productId: string,
    variantId?: string | null,
  ): Promise<
    Array<{
      item: WishlistItem;
      userId: string | null;
    }>
  > {
    const query = db
      .select({
        item: wishlistItems,
        userId: wishlists.userId,
      })
      .from(wishlistItems)
      .innerJoin(wishlists, eq(wishlistItems.wishlistId, wishlists.id))
      .where(
        variantId
          ? and(
              eq(wishlistItems.productId, productId),
              eq(wishlistItems.variantId, variantId),
            )
          : eq(wishlistItems.productId, productId),
      );

    const rows = await query;
    return rows.map((r) => ({
      item: this.mapWishlistItem(r.item),
      userId: r.userId,
    }));
  }

  async updateCurrentPrice(
    productId: string,
    variantId: string | null | undefined,
    newPrice: number,
  ): Promise<number> {
    const condition = variantId
      ? and(
          eq(wishlistItems.productId, productId),
          eq(wishlistItems.variantId, variantId),
        )
      : eq(wishlistItems.productId, productId);

    const result = await db
      .update(wishlistItems)
      .set({
        currentPrice: newPrice.toFixed(2),
        updatedAt: new Date(),
      })
      .where(condition);

    return result.rowCount ?? 0;
  }

  async updateStockStatus(
    productId: string,
    variantId: string | null | undefined,
    inStock: boolean,
  ): Promise<number> {
    const condition = variantId
      ? and(
          eq(wishlistItems.productId, productId),
          eq(wishlistItems.variantId, variantId),
        )
      : eq(wishlistItems.productId, productId);

    const result = await db
      .update(wishlistItems)
      .set({
        inStock,
        updatedAt: new Date(),
      })
      .where(condition);

    return result.rowCount ?? 0;
  }

  private mapWishlistItem(
    row: typeof WishlistItemsTable.$inferSelect,
  ): WishlistItem {
    return {
      id: row.id,
      wishlistId: row.wishlistId,
      productId: row.productId,
      variantId: row.variantId,
      addedPrice: Number(row.addedPrice || 0),
      currentPrice: row.currentPrice ? Number(row.currentPrice) : null,
      inStock: row.inStock,
      note: row.note,
      priority: row.priority,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const wishlistItemRepository = new WishlistItemRepository();
