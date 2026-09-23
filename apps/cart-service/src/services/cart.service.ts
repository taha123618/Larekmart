import { Cart, type CartDocType } from "@repo/cart-db";
import {
  cartRepository,
  CartRepository,
} from "../repositories/cart.repository.js";
import { pricingService } from "./pricing.service.js";
import { publishCartEvent } from "../publishers/cart.publisher.js";
import {
  getCachedCart,
  setCachedCart,
  getCartCacheKey,
  invalidateCartCache,
  scheduleCartExpiration,
} from "../cache/cart-cache.js";
import { VALID_PROMOTIONS } from "../pricing/discounts.js";
import { validationService } from "./validation.service.js";
import { env } from "../config/env.js";
import { logger } from "../observability/metrics.js";
import type { CartResponseType, CartSummaryType } from "@repo/types";

export interface CartIdentity {
  userId?: string | null;
  guestToken?: string | null;
}

export class CartService {
  /**
   * Retrieves active cart from cache/database or creates a new empty active cart
   */
  async getOrCreateCart(identity: CartIdentity): Promise<{
    cart: CartDocType;
    formatted: CartResponseType;
    isNew: boolean;
  }> {
    const cacheKey = getCartCacheKey(identity);

    // 1. Try Redis cache
    const cached = await getCachedCart(cacheKey);
    if (cached) {
      const doc = await cartRepository.findById(cached.id);
      if (doc && doc.status === "active") {
        return { cart: doc, formatted: cached, isNew: false };
      }
    }

    // 2. Query MongoDB
    let cart: CartDocType | null = null;
    if (identity.userId) {
      cart = await cartRepository.findActiveByUserId(identity.userId);
    } else if (identity.guestToken) {
      cart = await cartRepository.findActiveByGuestToken(identity.guestToken);
    }

    if (cart) {
      const formatted = CartRepository.formatCart(cart);
      await setCachedCart(cacheKey, formatted);
      return { cart, formatted, isNew: false };
    }

    // 3. Create new cart
    const ttlSeconds = identity.userId
      ? env.USER_CART_TTL_SECONDS
      : env.GUEST_CART_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    cart = new Cart({
      userId: identity.userId || null,
      guestToken: identity.guestToken || null,
      status: "active",
      currency: "PKR",
      items: [],
      coupons: [],
      adjustments: [],
      pricing: {
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 0,
      },
      snapshots: [],
      version: 1,
      expiresAt,
    });

    await cart.save();

    // Schedule expiration tracking in Redis sorted set
    await scheduleCartExpiration(cart._id.toString(), expiresAt);

    const formatted = CartRepository.formatCart(cart);
    await setCachedCart(cacheKey, formatted);

    await publishCartEvent("cart.created", {
      cartId: cart._id.toString(),
      userId: cart.userId,
      guestToken: cart.guestToken,
    });

    return { cart, formatted, isNew: true };
  }

  /**
   * Applies coupon to cart
   */
  async applyCoupon(
    cart: CartDocType,
    code: string,
  ): Promise<CartResponseType> {
    const upperCode = code.toUpperCase().trim();
    const promotion = VALID_PROMOTIONS[upperCode];

    if (!promotion) {
      throw new Error(`Invalid or expired coupon code: ${code}`);
    }

    const existingCoupon = cart.coupons.find((c) => c.code === upperCode);
    if (existingCoupon) {
      return CartRepository.formatCart(cart); // Already applied
    }

    cart.coupons.push({
      code: upperCode,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      appliedAmount: 0,
      minOrderAmount: promotion.minOrderAmount,
    } as any);

    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    await publishCartEvent("cart.coupon_added", {
      cartId: cart._id.toString(),
      userId: cart.userId,
      guestToken: cart.guestToken,
      couponCode: upperCode,
    });

    return CartRepository.formatCart(cart);
  }

  /**
   * Removes coupon from cart
   */
  async removeCoupon(
    cart: CartDocType,
    code: string,
  ): Promise<CartResponseType> {
    const upperCode = code.toUpperCase().trim();
    const index = cart.coupons.findIndex((c) => c.code === upperCode);

    if (index > -1) {
      cart.coupons.splice(index, 1);
      pricingService.recalculateCart(cart);
      cart.version = (cart.version || 1) + 1;
      await cart.save();

      await invalidateCartCache({
        userId: cart.userId,
        guestToken: cart.guestToken,
      });
      await publishCartEvent("cart.coupon_removed", {
        cartId: cart._id.toString(),
        userId: cart.userId,
        guestToken: cart.guestToken,
        couponCode: upperCode,
      });
    }

    return CartRepository.formatCart(cart);
  }

  /**
   * Clears all items and coupons from cart
   */
  async clearCart(cart: CartDocType): Promise<CartResponseType> {
    cart.items = [] as any;
    cart.coupons = [] as any;
    cart.adjustments = [] as any;
    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    await publishCartEvent("cart.cleared", {
      cartId: cart._id.toString(),
      userId: cart.userId,
      guestToken: cart.guestToken,
    });

    return CartRepository.formatCart(cart);
  }

  /**
   * Revalidates prices against catalog and recalculates cart
   */
  async refreshPricing(cart: CartDocType): Promise<CartResponseType> {
    for (const item of cart.items) {
      const validated = await validationService.validateProduct(item.productId);
      if (
        validated &&
        validated.price > 0 &&
        validated.price !== item.unitPrice
      ) {
        cart.adjustments.push({
          itemId: item._id ? item._id.toString() : item.productId,
          productId: item.productId,
          reason: `Price updated from PKR ${item.unitPrice} to PKR ${validated.price}`,
          oldQuantity: item.quantity,
          newQuantity: item.quantity,
          createdAt: new Date(),
        } as any);
        item.unitPrice = validated.price;
        item.subtotal = validated.price * item.quantity;
      }
    }

    pricingService.recalculateCart(cart);
    cart.version = (cart.version || 1) + 1;
    await cart.save();

    await invalidateCartCache({
      userId: cart.userId,
      guestToken: cart.guestToken,
    });
    return CartRepository.formatCart(cart);
  }

  /**
   * Returns lightweight summary
   */
  getSummary(cart: CartDocType): CartSummaryType {
    const totalItems = (cart.items || []).reduce(
      (acc, item) => acc + item.quantity,
      0,
    );
    return {
      id: cart._id.toString(),
      totalItems,
      grandTotal: cart.pricing?.grandTotal || 0,
      currency: cart.currency || "PKR",
      expiresAt: new Date(cart.expiresAt).toISOString(),
    };
  }

  /**
   * Returns aggregated statistics for admin dashboard
   */
  async getAdminStats() {
    return cartRepository.getStats();
  }

  /**
   * Returns recent carts for admin dashboard
   */
  async getRecentCarts(limit = 20): Promise<CartResponseType[]> {
    return cartRepository.getRecentCarts(limit);
  }
}

export const cartService = new CartService();
