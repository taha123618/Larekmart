import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  wishlistShares,
  type wishlistShares as WishlistSharesTable,
} from "../db/schema.js";
import type { WishlistShare, SharePermission } from "@repo/types";

export class WishlistShareRepository {
  async createShare(data: {
    wishlistId: string;
    shareToken: string;
    permission?: SharePermission;
    expiresAt?: Date | null;
  }): Promise<WishlistShare> {
    const [row] = await db
      .insert(wishlistShares)
      .values({
        wishlistId: data.wishlistId,
        shareToken: data.shareToken,
        permission: data.permission ?? "VIEW",
        expiresAt: data.expiresAt || null,
      })
      .returning();

    if (!row) throw new Error("Failed to create wishlist share token");
    return this.mapShare(row);
  }

  async findByToken(token: string): Promise<WishlistShare | null> {
    const now = new Date();
    const rows = await db
      .select()
      .from(wishlistShares)
      .where(
        and(
          eq(wishlistShares.shareToken, token),
          sql`(${wishlistShares.expiresAt} IS NULL OR ${wishlistShares.expiresAt} > ${now})`,
        ),
      )
      .limit(1);

    if (!rows[0]) return null;
    return this.mapShare(rows[0]);
  }

  async findByWishlistId(wishlistId: string): Promise<WishlistShare[]> {
    const rows = await db
      .select()
      .from(wishlistShares)
      .where(eq(wishlistShares.wishlistId, wishlistId));

    return rows.map((r) => this.mapShare(r));
  }

  async deleteByWishlistId(wishlistId: string): Promise<number> {
    const result = await db
      .delete(wishlistShares)
      .where(eq(wishlistShares.wishlistId, wishlistId));
    return result.rowCount ?? 0;
  }

  private mapShare(
    row: typeof WishlistSharesTable.$inferSelect,
  ): WishlistShare {
    return {
      id: row.id,
      wishlistId: row.wishlistId,
      shareToken: row.shareToken,
      permission: row.permission as SharePermission,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}

export const wishlistShareRepository = new WishlistShareRepository();
