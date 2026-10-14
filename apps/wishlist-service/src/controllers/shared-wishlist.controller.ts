import type { FastifyRequest, FastifyReply } from "fastify";
import { wishlistService } from "../services/wishlist.service.js";

export class SharedWishlistController {
  async getSharedWishlist(request: FastifyRequest, reply: FastifyReply) {
    const params = (request.params as { shareToken?: string }) || {};
    const shareToken = params.shareToken!;

    const result = await wishlistService.getSharedWishlist(shareToken);
    if (!result) {
      return reply
        .status(404)
        .send({ message: "Shared wishlist not found or link has expired" });
    }

    return reply.status(200).send({
      wishlist: result.wishlist,
      items: result.items,
      permission: result.permission,
    });
  }
}

export const sharedWishlistController = new SharedWishlistController();
