import {
  CartRepository,
  cartRepository,
} from "../repositories/cart.repository.js";
import { pricingService } from "./pricing.service.js";
import { publishCartEvent } from "../publishers/cart.publisher.js";
import { invalidateCartCache } from "../cache/cart-cache.js";
import { logger } from "../observability/metrics.js";
import type { CartResponseType } from "@repo/types";
import { Cart } from "@repo/cart-db";

const MAX_ITEM_QUANTITY = 10;

type CartSession = Awaited<ReturnType<typeof Cart.startSession>>;

export class MergeService {
  /**
   * Checks whether the underlying MongoDB deployment supports multi-document transactions.
   * Multi-document transactions require a replica set member or mongos (sharded cluster).
   */
  private supportsTransactions(): boolean {
    try {
      const topologyType = (Cart.db as any)?.client?.topology?.description
        ?.type;
      return (
        topologyType === "ReplicaSetWithPrimary" || topologyType === "Sharded"
      );
    } catch {
      return false;
    }
  }

  /**
   * Internal implementation of the cart merge logic, with optional session support.
   */
  private async executeMerge(
    userId: string,
    guestToken: string,
    session?: CartSession,
  ): Promise<CartResponseType> {
    const guestCartQuery = Cart.findOne({
      guestToken,
      status: "active",
    });
    if (session) guestCartQuery.session(session);
    const guestCart = await guestCartQuery;

    const userCartQuery = Cart.findOne({ userId, status: "active" });
    if (session) userCartQuery.session(session);
    let userCart = await userCartQuery;

    if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
      // If no active guest cart or guest cart is empty, return user cart (or create if needed)
      if (!userCart) {
        userCart = new Cart({
          userId,
          status: "active",
          items: [],
          coupons: [],
          adjustments: [],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        pricingService.recalculateCart(userCart);
        if (session) {
          await userCart.save({ session });
        } else {
          await userCart.save();
        }
      }
      return CartRepository.formatCart(userCart);
    }

    if (!userCart) {
      // Promote guest cart to user cart
      guestCart.userId = userId;
      guestCart.guestToken = null as any;
      guestCart.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      guestCart.version = (guestCart.version || 1) + 1;
      pricingService.recalculateCart(guestCart);
      if (session) {
        await guestCart.save({ session });
      } else {
        await guestCart.save();
      }

      await invalidateCartCache({ userId, guestToken });
      await publishCartEvent("cart.merged", {
        cartId: guestCart._id.toString(),
        userId,
        guestToken,
      });

      return CartRepository.formatCart(guestCart);
    }

    // Merge items from guestCart into userCart
    for (const guestItem of guestCart.items) {
      const existingIndex = userCart.items.findIndex(
        (uItem) =>
          uItem.productId === guestItem.productId &&
          (uItem.variantId || "") === (guestItem.variantId || "") &&
          (uItem.size || "") === (guestItem.size || "") &&
          (uItem.color || "") === (guestItem.color || ""),
      );

      if (existingIndex > -1) {
        const existingItem = userCart.items[existingIndex]!;
        const combinedQuantity = existingItem.quantity + guestItem.quantity;

        if (combinedQuantity > MAX_ITEM_QUANTITY) {
          existingItem.quantity = MAX_ITEM_QUANTITY;
          userCart.adjustments.push({
            itemId: existingItem._id
              ? existingItem._id.toString()
              : existingItem.productId,
            productId: existingItem.productId,
            reason: `Quantity capped to maximum limit of ${MAX_ITEM_QUANTITY} during merge`,
            oldQuantity: combinedQuantity,
            newQuantity: MAX_ITEM_QUANTITY,
            createdAt: new Date(),
          } as any);
        } else {
          existingItem.quantity = combinedQuantity;
        }
        existingItem.subtotal = existingItem.unitPrice * existingItem.quantity;
      } else {
        // Add new item from guest cart
        let qty = guestItem.quantity;
        if (qty > MAX_ITEM_QUANTITY) {
          userCart.adjustments.push({
            itemId: guestItem.productId,
            productId: guestItem.productId,
            reason: `Quantity capped to maximum limit of ${MAX_ITEM_QUANTITY} during merge`,
            oldQuantity: qty,
            newQuantity: MAX_ITEM_QUANTITY,
            createdAt: new Date(),
          } as any);
          qty = MAX_ITEM_QUANTITY;
        }

        userCart.items.push({
          productId: guestItem.productId,
          variantId: guestItem.variantId,
          name: guestItem.name,
          image: guestItem.image,
          size: guestItem.size,
          color: guestItem.color,
          quantity: qty,
          unitPrice: guestItem.unitPrice,
          discountAmount: guestItem.discountAmount || 0,
          subtotal: guestItem.unitPrice * qty,
          metadata: guestItem.metadata || {},
          pricingVersion: guestItem.pricingVersion || 1,
        } as any);
      }
    }

    // Merge unique coupons
    for (const guestCoupon of guestCart.coupons) {
      const couponExists = userCart.coupons.some(
        (c) => c.code === guestCoupon.code,
      );
      if (!couponExists) {
        userCart.coupons.push(guestCoupon as any);
      }
    }

    // Mark guest cart as merged
    guestCart.status = "merged";
    guestCart.version = (guestCart.version || 1) + 1;
    if (session) {
      await guestCart.save({ session });
    } else {
      await guestCart.save();
    }

    // Recalculate totals and save user cart
    pricingService.recalculateCart(userCart);
    userCart.version = (userCart.version || 1) + 1;
    if (session) {
      await userCart.save({ session });
    } else {
      await userCart.save();
    }

    // Invalidate both Redis caches
    await invalidateCartCache({ userId, guestToken });

    // Publish Kafka merge event
    await publishCartEvent("cart.merged", {
      cartId: userCart._id.toString(),
      userId,
      guestToken,
    });

    logger.info("Successfully merged guest cart into user cart", {
      userId,
      guestToken,
      cartId: userCart._id.toString(),
    });
    return CartRepository.formatCart(userCart);
  }

  /**
   * Merges an anonymous guest cart into an authenticated user's cart
   */
  async mergeCarts(
    userId: string,
    guestToken: string,
  ): Promise<CartResponseType> {
    const canUseTransactions = this.supportsTransactions();

    if (canUseTransactions) {
      let session: CartSession | null = null;
      try {
        session = await Cart.startSession();
        session.startTransaction();

        const result = await this.executeMerge(userId, guestToken, session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        if (session) {
          await session.abortTransaction().catch(() => {});
        }

        // Graceful fallback if transaction numbers are not allowed on this instance
        if (
          error instanceof Error &&
          error.message.includes("Transaction numbers are only allowed")
        ) {
          logger.warn(
            "MongoDB deployment does not support transactions; executing non-transactional merge fallback",
            { userId, guestToken },
          );
          return await this.executeMerge(userId, guestToken);
        }

        logger.error("Cart merge transaction failed", error as Error, {
          userId,
          guestToken,
        });
        throw error;
      } finally {
        if (session) {
          session.endSession();
        }
      }
    }

    // Non-transactional execution for standalone MongoDB topologies
    try {
      return await this.executeMerge(userId, guestToken);
    } catch (error) {
      logger.error("Cart merge failed", error as Error, {
        userId,
        guestToken,
      });
      throw error;
    }
  }
}

export const mergeService = new MergeService();
