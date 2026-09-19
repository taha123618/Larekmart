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

export class MergeService {
  /**
   * Merges an anonymous guest cart into an authenticated user's cart
   */
  async mergeCarts(
    userId: string,
    guestToken: string,
  ): Promise<CartResponseType> {
    const session = await Cart.startSession();
    session.startTransaction();

    try {
      const guestCart = await Cart.findOne({
        guestToken,
        status: "active",
      }).session(session);
      let userCart = await Cart.findOne({ userId, status: "active" }).session(
        session,
      );

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
          await userCart.save({ session });
        }
        await session.commitTransaction();
        return CartRepository.formatCart(userCart);
      }

      if (!userCart) {
        // Promote guest cart to user cart
        guestCart.userId = userId;
        guestCart.guestToken = null as any;
        guestCart.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        guestCart.version = (guestCart.version || 1) + 1;
        pricingService.recalculateCart(guestCart);
        await guestCart.save({ session });

        await session.commitTransaction();

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
          existingItem.subtotal =
            existingItem.unitPrice * existingItem.quantity;
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
      await guestCart.save({ session });

      // Recalculate totals and save user cart
      pricingService.recalculateCart(userCart);
      userCart.version = (userCart.version || 1) + 1;
      await userCart.save({ session });

      await session.commitTransaction();

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
    } catch (error) {
      await session.abortTransaction();
      logger.error("Cart merge transaction failed", error as Error, {
        userId,
        guestToken,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const mergeService = new MergeService();
