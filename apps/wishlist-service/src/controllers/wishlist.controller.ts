import type { FastifyRequest, FastifyReply } from "fastify";
import { wishlistService } from "../services/wishlist.service.js";
import {
  CreateWishlistSchema,
  UpdateWishlistSchema,
  AddWishlistItemSchema,
  BulkRemoveItemsSchema,
  MoveWishlistItemSchema,
  MergeWishlistSchema,
  CreateShareTokenSchema,
  WishlistQuerySchema,
} from "@repo/types";

export class WishlistController {
  async getMyWishlists(request: FastifyRequest, reply: FastifyReply) {
    const query = WishlistQuerySchema.parse(request.query || {});
    const result = await wishlistService.getUserWishlists(
      request.userId!,
      query.page,
      query.limit,
    );

    return reply.status(200).send({
      wishlists: result.wishlists,
      total: result.total,
      page: query.page,
      limit: query.limit,
    });
  }

  async createWishlist(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateWishlistSchema.parse(request.body);
    const wishlist = await wishlistService.createWishlist(
      request.userId || null,
      request.guestId || null,
      body,
    );

    return reply.status(201).send(wishlist);
  }

  async getWishlistById(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const query = WishlistQuerySchema.parse(request.query || {});

    const wishlist = await wishlistService.getWishlistById(
      wishlistId,
      request.userId,
      request.guestId,
      query.page,
      query.limit,
    );

    if (!wishlist) {
      return reply.status(404).send({ message: "Wishlist not found" });
    }

    return reply.status(200).send(wishlist);
  }

  async updateWishlist(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const body = UpdateWishlistSchema.parse(request.body);

    const updated = await wishlistService.updateWishlist(
      wishlistId,
      request.userId!,
      body,
    );

    if (!updated) {
      return reply
        .status(404)
        .send({ message: "Wishlist not found or unauthorized" });
    }

    return reply.status(200).send(updated);
  }

  async deleteWishlist(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const deleted = await wishlistService.deleteWishlist(
      wishlistId,
      request.userId!,
    );

    if (!deleted) {
      return reply
        .status(404)
        .send({ message: "Wishlist not found or unauthorized" });
    }

    return reply.status(200).send({ message: "Wishlist successfully deleted" });
  }

  async addItem(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const body = AddWishlistItemSchema.parse(request.body);

    const { item, isDuplicate } = await wishlistService.addItem(
      wishlistId,
      request.userId || null,
      request.guestId || null,
      body,
    );

    return reply.status(isDuplicate ? 200 : 201).send({
      message: isDuplicate
        ? "Product is already in your wishlist"
        : "Product added to wishlist",
      item,
      isDuplicate,
    });
  }

  async removeItem(request: FastifyRequest, reply: FastifyReply) {
    const params =
      (request.params as { wishlistId?: string; itemId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const itemId = params.itemId!;

    const removed = await wishlistService.removeItem(
      wishlistId,
      itemId,
      request.userId || null,
      request.guestId || null,
    );

    if (!removed) {
      return reply
        .status(404)
        .send({ message: "Item not found in wishlist or unauthorized" });
    }

    return reply
      .status(200)
      .send({ message: "Item successfully removed from wishlist" });
  }

  async bulkRemoveItems(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const body = BulkRemoveItemsSchema.parse(request.body);

    const removedCount = await wishlistService.bulkRemoveItems(
      wishlistId,
      body.itemIds,
      request.userId || null,
      request.guestId || null,
    );

    return reply.status(200).send({
      message: `${removedCount} items removed from wishlist`,
      removedCount,
    });
  }

  async moveItem(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const sourceWishlistId = params.wishlistId!;
    const body = MoveWishlistItemSchema.extend({
      itemId: AddWishlistItemSchema.shape.productId,
    }).parse(request.body);

    try {
      const movedItem = await wishlistService.moveItem(
        sourceWishlistId,
        body.itemId,
        body.targetWishlistId,
        request.userId!,
      );

      return reply.status(200).send({
        message: "Item moved successfully",
        item: movedItem,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to move item";
      return reply.status(400).send({ message });
    }
  }

  async mergeWishlists(request: FastifyRequest, reply: FastifyReply) {
    const body = MergeWishlistSchema.parse(request.body);
    const result = await wishlistService.mergeGuestWishlist(
      request.userId!,
      body.guestId,
      body.conflictStrategy,
    );

    return reply.status(200).send({
      message: `Successfully merged ${result.mergedCount} items into your wishlist`,
      ...result,
    });
  }

  async createShareToken(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { wishlistId?: string }) || {};
    const wishlistId = params.wishlistId!;
    const body = CreateShareTokenSchema.parse(request.body || {});

    const share = await wishlistService.createShareToken(
      wishlistId,
      request.userId!,
      body,
    );

    return reply.status(201).send(share);
  }

  // 10. Admin Endpoints
  async getAdminOverview(_request: FastifyRequest, reply: FastifyReply) {
    const overview = await wishlistService.getAdminOverview();
    return reply.status(200).send(overview);
  }

  async listAllWishlists(request: FastifyRequest, reply: FastifyReply) {
    const query =
      (request.query as {
        page?: string;
        limit?: string;
        search?: string;
      }) || {};

    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
    const search = query.search;

    const result = await wishlistService.listAllWishlists(page, limit, search);
    return reply.status(200).send(result);
  }
}

export const wishlistController = new WishlistController();
