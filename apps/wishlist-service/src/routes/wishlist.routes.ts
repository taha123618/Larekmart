import type { FastifyInstance } from "fastify";
import { wishlistController } from "../controllers/wishlist.controller.js";
import {
  shouldBeUser,
  optionalUserOrGuest,
  shouldBeAdmin,
} from "../middleware/auth.middleware.js";

export async function wishlistRoutes(fastify: FastifyInstance) {
  // 1. Customer Wishlists List & Create
  fastify.get(
    "/api/v1/me/wishlists",
    { preHandler: shouldBeUser },
    wishlistController.getMyWishlists.bind(wishlistController),
  );

  fastify.post(
    "/api/v1/me/wishlists",
    { preHandler: optionalUserOrGuest },
    wishlistController.createWishlist.bind(wishlistController),
  );

  // 2. Guest-to-User Wishlist Merge
  fastify.post(
    "/api/v1/me/wishlists/merge",
    { preHandler: shouldBeUser },
    wishlistController.mergeWishlists.bind(wishlistController),
  );

  // 3. Single Wishlist Resource Details, Update, Delete
  fastify.get(
    "/api/v1/me/wishlists/:wishlistId",
    { preHandler: optionalUserOrGuest },
    wishlistController.getWishlistById.bind(wishlistController),
  );

  fastify.patch(
    "/api/v1/me/wishlists/:wishlistId",
    { preHandler: shouldBeUser },
    wishlistController.updateWishlist.bind(wishlistController),
  );

  fastify.delete(
    "/api/v1/me/wishlists/:wishlistId",
    { preHandler: shouldBeUser },
    wishlistController.deleteWishlist.bind(wishlistController),
  );

  // 4. Wishlist Items: Add, Remove single, Bulk remove
  fastify.post(
    "/api/v1/me/wishlists/:wishlistId/items",
    { preHandler: optionalUserOrGuest },
    wishlistController.addItem.bind(wishlistController),
  );

  fastify.delete(
    "/api/v1/me/wishlists/:wishlistId/items/:itemId",
    { preHandler: optionalUserOrGuest },
    wishlistController.removeItem.bind(wishlistController),
  );

  fastify.delete(
    "/api/v1/me/wishlists/:wishlistId/items",
    { preHandler: optionalUserOrGuest },
    wishlistController.bulkRemoveItems.bind(wishlistController),
  );

  // 5. Move Items Between Wishlists
  fastify.post(
    "/api/v1/me/wishlists/:wishlistId/items/move",
    { preHandler: shouldBeUser },
    wishlistController.moveItem.bind(wishlistController),
  );

  // 6. Generate Unguessable Share Token
  fastify.post(
    "/api/v1/me/wishlists/:wishlistId/share",
    { preHandler: shouldBeUser },
    wishlistController.createShareToken.bind(wishlistController),
  );

  // 7. Admin Endpoints
  fastify.get(
    "/api/v1/admin/wishlists/overview",
    { preHandler: shouldBeAdmin },
    wishlistController.getAdminOverview.bind(wishlistController),
  );

  fastify.get(
    "/api/v1/admin/wishlists",
    { preHandler: shouldBeAdmin },
    wishlistController.listAllWishlists.bind(wishlistController),
  );
}
