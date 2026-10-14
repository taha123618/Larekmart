import crypto from "node:crypto";
import { wishlistRepository } from "../repositories/wishlist.repository.js";
import { wishlistItemRepository } from "../repositories/wishlist-item.repository.js";
import { wishlistShareRepository } from "../repositories/wishlist-share.repository.js";
import { redis } from "../utils/redis.js";
import { cacheSet } from "@repo/redis";
import {
  publishWishlistCreated,
  publishWishlistItemAdded,
  publishWishlistItemRemoved,
  publishWishlistItemMoved,
  publishWishlistMerged,
} from "../events/producers/wishlist.producer.js";
import { recordWishlistOperation, logger } from "../observability/metrics.js";
import type {
  Wishlist,
  WishlistItem,
  WishlistWithItems,
  WishlistShare,
  CreateWishlistInput,
  UpdateWishlistInput,
  AddWishlistItemInput,
  UpdateWishlistItemInput,
  CreateShareTokenInput,
} from "@repo/types";

export class WishlistService {
  /**
   * Retrieves or automatically initializes customer wishlists.
   * Creates a default wishlist if none exists.
   */
  async getUserWishlists(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ wishlists: Wishlist[]; total: number }> {
    const offset = (page - 1) * limit;
    let result = await wishlistRepository.findByUserId(userId, limit, offset);

    if (result.total === 0) {
      // Auto-create default wishlist for authenticated customer
      const defaultWishlist = await wishlistRepository.create({
        userId,
        name: "My Wishlist",
        isDefault: true,
        visibility: "PRIVATE",
      });

      await wishlistRepository.logEvent({
        wishlistId: defaultWishlist.id,
        eventType: "CREATED",
        actorId: userId,
        payload: { defaultCreated: true },
      });

      await publishWishlistCreated({
        wishlistId: defaultWishlist.id,
        userId,
        guestId: null,
        name: defaultWishlist.name,
        isDefault: true,
        visibility: defaultWishlist.visibility,
        createdAt: defaultWishlist.createdAt.toISOString(),
      });

      result = {
        wishlists: [defaultWishlist],
        total: 1,
      };
    }

    return result;
  }

  /**
   * Retrieves guest wishlists by guest identifier.
   */
  async getGuestWishlists(guestId: string): Promise<Wishlist[]> {
    return wishlistRepository.findByGuestId(guestId);
  }

  /**
   * Retrieves a single wishlist by ID, verifying ownership or access.
   */
  async getWishlistById(
    wishlistId: string,
    userId?: string | null,
    guestId?: string | null,
    page = 1,
    limit = 50,
  ): Promise<WishlistWithItems | null> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist) return null;

    // Access control check: owner, public, or guest match
    const isOwner =
      (userId && wishlist.userId === userId) ||
      (guestId && wishlist.guestId === guestId);

    if (!isOwner && wishlist.visibility === "PRIVATE") {
      return null;
    }

    const offset = (page - 1) * limit;
    const { items, total } = await wishlistItemRepository.findByWishlistId(
      wishlistId,
      limit,
      offset,
    );

    return {
      ...wishlist,
      items,
      itemCount: total,
    };
  }

  /**
   * Creates a new named wishlist (e.g. Favorites, Gift Ideas).
   */
  async createWishlist(
    userId: string | null,
    guestId: string | null,
    input: CreateWishlistInput,
  ): Promise<Wishlist> {
    if (userId && input.isDefault) {
      await wishlistRepository.unsetOtherDefaults(userId);
    }

    const wishlist = await wishlistRepository.create({
      userId,
      guestId,
      name: input.name,
      isDefault: Boolean(input.isDefault),
      visibility: input.visibility ?? "PRIVATE",
    });

    await wishlistRepository.logEvent({
      wishlistId: wishlist.id,
      eventType: "CREATED",
      actorId: userId || guestId || "anonymous",
      payload: input,
    });

    await publishWishlistCreated({
      wishlistId: wishlist.id,
      userId,
      guestId,
      name: wishlist.name,
      isDefault: wishlist.isDefault,
      visibility: wishlist.visibility,
      createdAt: wishlist.createdAt.toISOString(),
    });

    recordWishlistOperation("create");
    return wishlist;
  }

  /**
   * Updates an existing wishlist (name, visibility, isDefault).
   */
  async updateWishlist(
    wishlistId: string,
    userId: string,
    input: UpdateWishlistInput,
  ): Promise<Wishlist | null> {
    const existing = await wishlistRepository.findById(wishlistId);
    if (!existing || existing.userId !== userId) return null;

    const updated = await wishlistRepository.update(wishlistId, input);

    if (updated) {
      await wishlistRepository.logEvent({
        wishlistId,
        eventType: "UPDATED",
        actorId: userId,
        payload: input,
      });
    }

    return updated;
  }

  /**
   * Deletes a wishlist and all associated items and shares.
   */
  async deleteWishlist(wishlistId: string, userId: string): Promise<boolean> {
    const existing = await wishlistRepository.findById(wishlistId);
    if (!existing || existing.userId !== userId) return false;

    const deleted = await wishlistRepository.delete(wishlistId);
    if (deleted) {
      recordWishlistOperation("delete");
    }
    return deleted;
  }

  /**
   * Adds an item to a wishlist with strict duplicate prevention.
   */
  async addItem(
    wishlistId: string,
    userId: string | null,
    guestId: string | null,
    input: AddWishlistItemInput,
  ): Promise<{ item: WishlistItem; isDuplicate: boolean }> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist) {
      throw new Error("Wishlist not found");
    }

    const isOwner =
      (userId && wishlist.userId === userId) ||
      (guestId && wishlist.guestId === guestId);
    if (!isOwner) {
      throw new Error("Unauthorized to modify this wishlist");
    }

    // 1. Strict Duplicate Prevention check
    const existing = await wishlistItemRepository.findExistingItem(
      wishlistId,
      input.productId,
      input.variantId,
    );

    if (existing) {
      return { item: existing, isDuplicate: true };
    }

    // 2. Insert Item
    const item = await wishlistItemRepository.create({
      wishlistId,
      productId: input.productId,
      variantId: input.variantId,
      addedPrice: input.addedPrice ?? 0,
      note: input.note,
      priority: input.priority ?? 0,
    });

    await wishlistRepository.logEvent({
      wishlistId,
      eventType: "ITEM_ADDED",
      actorId: userId || guestId || "anonymous",
      payload: { itemId: item.id, productId: item.productId },
    });

    await publishWishlistItemAdded({
      wishlistId,
      itemId: item.id,
      userId,
      guestId,
      productId: item.productId,
      variantId: item.variantId,
      addedPrice: item.addedPrice,
      addedAt: item.createdAt.toISOString(),
    });

    recordWishlistOperation("add_item");
    return { item, isDuplicate: false };
  }

  /**
   * Updates an item's note or priority.
   */
  async updateItem(
    wishlistId: string,
    itemId: string,
    userId: string | null,
    guestId: string | null,
    input: UpdateWishlistItemInput,
  ): Promise<WishlistItem | null> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist) return null;

    const isOwner =
      (userId && wishlist.userId === userId) ||
      (guestId && wishlist.guestId === guestId);
    if (!isOwner) return null;

    return wishlistItemRepository.update(itemId, input);
  }

  /**
   * Removes a single item from a wishlist.
   */
  async removeItem(
    wishlistId: string,
    itemId: string,
    userId: string | null,
    guestId: string | null,
  ): Promise<boolean> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist) return false;

    const isOwner =
      (userId && wishlist.userId === userId) ||
      (guestId && wishlist.guestId === guestId);
    if (!isOwner) return false;

    const item = await wishlistItemRepository.findById(itemId);
    if (!item || item.wishlistId !== wishlistId) return false;

    const deleted = await wishlistItemRepository.delete(itemId);
    if (deleted) {
      await wishlistRepository.logEvent({
        wishlistId,
        eventType: "ITEM_REMOVED",
        actorId: userId || guestId || "anonymous",
        payload: { itemId, productId: item.productId },
      });

      await publishWishlistItemRemoved({
        wishlistId,
        itemId,
        userId,
        guestId,
        productId: item.productId,
        variantId: item.variantId,
        removedAt: new Date().toISOString(),
      });

      recordWishlistOperation("remove_item");
    }

    return deleted;
  }

  /**
   * Bulk removes multiple items from a wishlist.
   */
  async bulkRemoveItems(
    wishlistId: string,
    itemIds: string[],
    userId: string | null,
    guestId: string | null,
  ): Promise<number> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist) return 0;

    const isOwner =
      (userId && wishlist.userId === userId) ||
      (guestId && wishlist.guestId === guestId);
    if (!isOwner) return 0;

    const count = await wishlistItemRepository.bulkDelete(wishlistId, itemIds);
    recordWishlistOperation("bulk_remove");
    return count;
  }

  /**
   * Moves an item between two user-owned wishlists.
   */
  async moveItem(
    sourceWishlistId: string,
    itemId: string,
    targetWishlistId: string,
    userId: string,
  ): Promise<WishlistItem | null> {
    const sourceWishlist = await wishlistRepository.findById(sourceWishlistId);
    const targetWishlist = await wishlistRepository.findById(targetWishlistId);

    if (
      !sourceWishlist ||
      !targetWishlist ||
      sourceWishlist.userId !== userId ||
      targetWishlist.userId !== userId
    ) {
      throw new Error("Forbidden: You do not own both wishlists");
    }

    const item = await wishlistItemRepository.findById(itemId);
    if (!item || item.wishlistId !== sourceWishlistId) {
      throw new Error("Item not found in source wishlist");
    }

    // Check if duplicate already exists in target wishlist
    const existingInTarget = await wishlistItemRepository.findExistingItem(
      targetWishlistId,
      item.productId,
      item.variantId,
    );
    if (existingInTarget) {
      // If already in target, remove from source to fulfill user's intent to move
      await wishlistItemRepository.delete(itemId);
      return existingInTarget;
    }

    const moved = await wishlistItemRepository.moveItem(
      itemId,
      targetWishlistId,
    );
    if (moved) {
      await wishlistRepository.logEvent({
        wishlistId: sourceWishlistId,
        eventType: "ITEM_MOVED",
        actorId: userId,
        payload: { itemId, targetWishlistId },
      });

      await publishWishlistItemMoved({
        sourceWishlistId,
        targetWishlistId,
        itemId,
        userId,
        productId: item.productId,
        variantId: item.variantId,
        movedAt: new Date().toISOString(),
      });

      recordWishlistOperation("move_item");
    }

    return moved;
  }

  /**
   * Merges guest wishlists into customer's default wishlist on login.
   */
  async mergeGuestWishlist(
    userId: string,
    guestId: string,
    conflictStrategy: "KEEP_EXISTING" | "OVERWRITE" = "KEEP_EXISTING",
  ): Promise<{ mergedCount: number; targetWishlistId: string }> {
    // 1. Locate or create customer's default wishlist
    let targetWishlist = await wishlistRepository.findDefaultWishlist(userId);
    if (!targetWishlist) {
      targetWishlist = await wishlistRepository.create({
        userId,
        name: "My Wishlist",
        isDefault: true,
        visibility: "PRIVATE",
      });
    }

    // 2. Fetch all guest wishlists and their items
    const guestWishlists = await wishlistRepository.findByGuestId(guestId);
    let mergedCount = 0;

    for (const gWishlist of guestWishlists) {
      const { items } = await wishlistItemRepository.findByWishlistId(
        gWishlist.id,
        1000,
        0,
      );

      for (const gItem of items) {
        const existingInTarget = await wishlistItemRepository.findExistingItem(
          targetWishlist.id,
          gItem.productId,
          gItem.variantId,
        );

        if (!existingInTarget) {
          await wishlistItemRepository.create({
            wishlistId: targetWishlist.id,
            productId: gItem.productId,
            variantId: gItem.variantId,
            addedPrice: gItem.addedPrice,
            note: gItem.note,
            priority: gItem.priority,
          });
          mergedCount++;
        } else if (conflictStrategy === "OVERWRITE") {
          await wishlistItemRepository.update(existingInTarget.id, {
            note: gItem.note,
            priority: gItem.priority,
          });
        }
      }

      // Cleanup guest wishlist
      await wishlistRepository.delete(gWishlist.id);
    }

    // 3. Log and publish merge event
    await wishlistRepository.logEvent({
      wishlistId: targetWishlist.id,
      eventType: "MERGED",
      actorId: userId,
      payload: { guestId, mergedCount, conflictStrategy },
    });

    await publishWishlistMerged({
      userId,
      guestId,
      wishlistId: targetWishlist.id,
      mergedCount,
      mergedAt: new Date().toISOString(),
    });

    recordWishlistOperation("merge");
    return { mergedCount, targetWishlistId: targetWishlist.id };
  }

  /**
   * Generates an unguessable share token with optional expiration and access control.
   */
  async createShareToken(
    wishlistId: string,
    userId: string,
    input: CreateShareTokenInput,
  ): Promise<WishlistShare> {
    const wishlist = await wishlistRepository.findById(wishlistId);
    if (!wishlist || wishlist.userId !== userId) {
      throw new Error("Wishlist not found or unauthorized");
    }

    // Generate unguessable 64-character token
    const shareToken = `wsh_${crypto.randomBytes(32).toString("hex")}`;
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const share = await wishlistShareRepository.createShare({
      wishlistId,
      shareToken,
      permission: input.permission ?? "VIEW",
      expiresAt,
    });

    // Cache token in Redis if expiration is specified
    const ttlSeconds = input.expiresInDays
      ? input.expiresInDays * 24 * 60 * 60
      : 86400 * 30; // default 30 days
    try {
      await cacheSet(
        redis.client,
        redis.keys.simple(`share:${shareToken}`),
        wishlistId,
        ttlSeconds,
      );
    } catch (err) {
      logger.warn("Redis share token caching failed:", { err });
    }

    await wishlistRepository.logEvent({
      wishlistId,
      eventType: "SHARED",
      actorId: userId,
      payload: { shareId: share.id, permission: share.permission },
    });

    return share;
  }

  /**
   * Resolves a shared wishlist using an unguessable token.
   * Access control prevents exposing private wishlists by raw ID.
   */
  async getSharedWishlist(
    shareToken: string,
  ): Promise<{
    wishlist: Wishlist;
    items: WishlistItem[];
    permission: string;
  } | null> {
    const share = await wishlistShareRepository.findByToken(shareToken);
    if (!share) return null;

    // Verify token expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      return null;
    }

    const wishlist = await wishlistRepository.findById(share.wishlistId);
    if (!wishlist) return null;

    const { items } = await wishlistItemRepository.findByWishlistId(
      wishlist.id,
      100,
      0,
    );

    return {
      wishlist,
      items,
      permission: share.permission,
    };
  }
}

export const wishlistService = new WishlistService();
