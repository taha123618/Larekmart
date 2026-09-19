import { Cart, type CartDocType } from "@repo/cart-db";
import type { CartResponseType, CartServiceItemType } from "@repo/types";
import { logger } from "../observability/metrics.js";

export class CartRepository {
  static formatCart(doc: CartDocType): CartResponseType {
    const raw = doc.toObject ? doc.toObject() : doc;
    const items: CartServiceItemType[] = (raw.items || []).map((item: any) => ({
      id: item._id ? item._id.toString() : item.id || "",
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.name,
      image: item.image || "",
      size: item.size || "",
      color: item.color || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount || 0,
      subtotal: item.subtotal || item.unitPrice * item.quantity,
      metadata: item.metadata || {},
      pricingVersion: item.pricingVersion || 1,
      createdAt: item.createdAt
        ? new Date(item.createdAt).toISOString()
        : undefined,
      updatedAt: item.updatedAt
        ? new Date(item.updatedAt).toISOString()
        : undefined,
    }));

    const coupons = (raw.coupons || []).map((c: any) => ({
      id: c._id ? c._id.toString() : c.id,
      code: c.code,
      discountType: c.discountType as "percentage" | "fixed",
      discountValue: c.discountValue,
      appliedAmount: c.appliedAmount,
      minOrderAmount: c.minOrderAmount,
    }));

    const adjustments = (raw.adjustments || []).map((a: any) => ({
      id: a._id ? a._id.toString() : a.id,
      itemId: a.itemId,
      productId: a.productId,
      reason: a.reason,
      oldQuantity: a.oldQuantity,
      newQuantity: a.newQuantity,
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : undefined,
    }));

    return {
      id: raw._id.toString(),
      userId: raw.userId || null,
      guestToken: raw.guestToken || null,
      status: raw.status as any,
      currency: raw.currency || "PKR",
      items,
      coupons,
      adjustments,
      pricing: {
        subtotal: raw.pricing?.subtotal || 0,
        discountTotal: raw.pricing?.discountTotal || 0,
        taxTotal: raw.pricing?.taxTotal || 0,
        shippingTotal: raw.pricing?.shippingTotal || 0,
        grandTotal: raw.pricing?.grandTotal || 0,
      },
      version: raw.version || 1,
      expiresAt: new Date(raw.expiresAt).toISOString(),
      createdAt: raw.createdAt
        ? new Date(raw.createdAt).toISOString()
        : undefined,
      updatedAt: raw.updatedAt
        ? new Date(raw.updatedAt).toISOString()
        : undefined,
    };
  }

  async findActiveByUserId(userId: string): Promise<CartDocType | null> {
    return Cart.findOne({ userId, status: "active" });
  }

  async findActiveByGuestToken(
    guestToken: string,
  ): Promise<CartDocType | null> {
    return Cart.findOne({ guestToken, status: "active" });
  }

  async findById(cartId: string): Promise<CartDocType | null> {
    return Cart.findById(cartId);
  }

  async create(data: Partial<CartDocType>): Promise<CartDocType> {
    const cart = new Cart(data);
    return cart.save();
  }

  async saveWithVersion(cart: CartDocType): Promise<CartDocType> {
    cart.version = (cart.version || 1) + 1;
    return cart.save();
  }

  async updateWithOptimisticLock(
    cartId: string,
    expectedVersion: number,
    update: Record<string, unknown>,
  ): Promise<CartDocType | null> {
    const result = await Cart.findOneAndUpdate(
      { _id: cartId, version: expectedVersion },
      {
        ...update,
        $inc: { version: 1 },
      },
      { new: true },
    );

    if (!result) {
      logger.warn("Optimistic concurrency lock failed for cart update", {
        cartId,
        expectedVersion,
      });
    }
    return result;
  }

  async expireCarts(cartIds: string[]): Promise<number> {
    if (cartIds.length === 0) return 0;
    const res = await Cart.updateMany(
      { _id: { $in: cartIds }, status: "active" },
      { $set: { status: "expired" }, $inc: { version: 1 } },
    );
    return res.modifiedCount;
  }

  async getStats(): Promise<{
    activeCarts: number;
    convertedCarts: number;
    expiredCarts: number;
    abandonedCarts: number;
    totalPipelineValue: number;
    averageItemsPerCart: number;
  }> {
    const counts = await Cart.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$pricing.grandTotal" },
          totalItems: { $sum: { $size: "$items" } },
        },
      },
    ]);

    const stats = {
      activeCarts: 0,
      convertedCarts: 0,
      expiredCarts: 0,
      abandonedCarts: 0,
      totalPipelineValue: 0,
      averageItemsPerCart: 0,
    };

    let activeItems = 0;
    for (const c of counts) {
      if (c._id === "active") {
        stats.activeCarts = c.count;
        stats.totalPipelineValue = c.totalValue || 0;
        activeItems = c.totalItems || 0;
      } else if (c._id === "converted") {
        stats.convertedCarts = c.count;
      } else if (c._id === "expired") {
        stats.expiredCarts = c.count;
      } else if (c._id === "abandoned") {
        stats.abandonedCarts = c.count;
      }
    }
    stats.averageItemsPerCart =
      stats.activeCarts > 0
        ? Number((activeItems / stats.activeCarts).toFixed(1))
        : 0;
    return stats;
  }

  async getRecentCarts(limit = 20): Promise<CartResponseType[]> {
    const docs = await Cart.find().sort({ updatedAt: -1 }).limit(limit);
    return docs.map((d) => CartRepository.formatCart(d as CartDocType));
  }
}

export const cartRepository = new CartRepository();
