import type { FastifyInstance } from "fastify";
import { sharedWishlistController } from "../controllers/shared-wishlist.controller.js";

export async function sharedWishlistRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/v1/shared-wishlists/:shareToken",
    sharedWishlistController.getSharedWishlist.bind(sharedWishlistController),
  );
}
