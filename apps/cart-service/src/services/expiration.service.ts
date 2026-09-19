import { cartRepository } from "../repositories/cart.repository.js";
import { popExpiredCartIds, invalidateCartCache } from "../cache/cart-cache.js";
import { publishCartEvent } from "../publishers/cart.publisher.js";
import { logger } from "../observability/metrics.js";
import { Cart } from "@repo/cart-db";

export class ExpirationService {
  async reapExpiredCarts(): Promise<number> {
    try {
      // 1. Check Redis sorted set for fast scheduled expirations
      const expiredIds = await popExpiredCartIds(50);

      // 2. Also query any MongoDB carts where expiresAt < now and status === 'active'
      const overdueDocs = await Cart.find({
        status: "active",
        expiresAt: { $lt: new Date() },
      })
        .limit(50)
        .select("_id userId guestToken");

      const allIds = Array.from(
        new Set([...expiredIds, ...overdueDocs.map((d) => d._id.toString())]),
      );

      if (allIds.length === 0) {
        return 0;
      }

      for (const cartId of allIds) {
        const cart = await Cart.findById(cartId);
        if (cart && cart.status === "active") {
          cart.status = "expired";
          cart.version = (cart.version || 1) + 1;
          await cart.save();

          await invalidateCartCache({
            userId: cart.userId,
            guestToken: cart.guestToken,
          });
          await publishCartEvent("cart.expired", {
            cartId,
            userId: cart.userId,
            guestToken: cart.guestToken,
          });
        }
      }

      logger.info("Reaped expired carts successfully", {
        count: allIds.length,
      });
      return allIds.length;
    } catch (err) {
      logger.error("Error reaping expired carts", err as Error);
      return 0;
    }
  }
}

export const expirationService = new ExpirationService();
