import { Cart, ProcessedEvent, ProductSnapshot } from "@repo/cart-db";
import { logger } from "../observability/metrics.js";
import { invalidateCartCache } from "../cache/cart-cache.js";
import { redis } from "../utils/redis.js";

interface ProductEventPayload {
  id?: string | number;
  productId?: string | number;
  price?: number;
  name?: string;
  images?: string[];
  image?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export const handleProductCreated = async (
  payload: ProductEventPayload,
): Promise<void> => {
  const targetId = String(payload.id || payload.productId || "");
  if (!targetId) return;

  const eventId = `prod_crt_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    const name = typeof payload.name === "string" ? payload.name : "Product";
    const price = typeof payload.price === "number" ? payload.price : 0;
    const image =
      Array.isArray(payload.images) && payload.images.length > 0
        ? String(payload.images[0])
        : typeof payload.image === "string"
          ? payload.image
          : "";

    // 1. Upsert local ProductSnapshot
    await ProductSnapshot.findOneAndUpdate(
      { productId: targetId },
      {
        $set: {
          productId: targetId,
          name,
          price,
          image,
          isActive: payload.isActive !== false,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // 2. Cache in Redis for sub-millisecond retrieval (1 day TTL)
    await redis.client.set(
      `cart:product:meta:${targetId}`,
      JSON.stringify({
        productId: targetId,
        name,
        price,
        image,
        isActive: payload.isActive !== false,
      }),
      "EX",
      86400,
    );

    await ProcessedEvent.create({
      eventId,
      eventType: "product.created",
      aggregateId: targetId,
    });

    logger.info("Created local product snapshot in cart-service", {
      targetId,
      name,
      price,
    });
  } catch (err) {
    logger.error(
      "Error processing product.created event in cart-service",
      err as Error,
      { targetId },
    );
  }
};

export const handleProductUpdated = async (
  payload: ProductEventPayload,
): Promise<void> => {
  const targetId = String(payload.id || payload.productId || "");
  if (!targetId) return;

  const eventId = `prod_upd_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const price = typeof payload.price === "number" ? payload.price : undefined;
    const image =
      Array.isArray(payload.images) && payload.images.length > 0
        ? String(payload.images[0])
        : typeof payload.image === "string"
          ? payload.image
          : undefined;

    // 1. Update local ProductSnapshot
    const updateDoc: Record<string, unknown> = {
      productId: targetId,
      isActive: payload.isActive !== false,
      updatedAt: new Date(),
    };
    if (name !== undefined) updateDoc.name = name;
    if (price !== undefined) updateDoc.price = price;
    if (image !== undefined) updateDoc.image = image;

    await ProductSnapshot.findOneAndUpdate(
      { productId: targetId },
      { $set: updateDoc },
      { upsert: true, new: true },
    );

    // 2. Refresh Redis cache
    const existingCache = await redis.client.get(
      `cart:product:meta:${targetId}`,
    );
    let parsedCache: Record<string, unknown> = {};
    if (existingCache) {
      try {
        parsedCache = JSON.parse(existingCache);
      } catch {}
    }
    const mergedCache = {
      ...parsedCache,
      productId: targetId,
      name: name ?? parsedCache.name ?? "Product",
      price: price ?? parsedCache.price ?? 0,
      image: image ?? parsedCache.image ?? "",
      isActive: payload.isActive !== false,
    };
    await redis.client.set(
      `cart:product:meta:${targetId}`,
      JSON.stringify(mergedCache),
      "EX",
      86400,
    );

    // 3. If price changed, update active carts
    if (typeof payload.price === "number") {
      const affectedCarts = await Cart.find(
        { status: "active", "items.productId": targetId },
        { userId: 1, guestToken: 1 },
      );

      const updatedResult = await Cart.updateMany(
        { status: "active", "items.productId": targetId },
        {
          $set: {
            "items.$[elem].unitPrice": payload.price,
            "items.$[elem].subtotal": {
              $multiply: ["$items.$[elem].quantity", payload.price],
            },
          },
        },
        { arrayFilters: [{ "elem.productId": targetId }] },
      );

      for (const c of affectedCarts) {
        await invalidateCartCache({
          userId: c.userId,
          guestToken: c.guestToken,
        });
      }

      logger.info(
        "Updated active cart item prices and snapshot from product.updated event",
        {
          targetId,
          modifiedCount: updatedResult.modifiedCount,
        },
      );
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "product.updated",
      aggregateId: targetId,
    });
  } catch (err) {
    logger.error(
      "Error processing product.updated event in cart-service",
      err as Error,
      { targetId },
    );
  }
};

export const handleProductDeleted = async (
  payload: ProductEventPayload,
): Promise<void> => {
  const targetId = String(payload.id || payload.productId || "");
  if (!targetId) return;

  const eventId = `prod_del_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    // 1. Mark snapshot as inactive in MongoDB
    await ProductSnapshot.findOneAndUpdate(
      { productId: targetId },
      { $set: { isActive: false, updatedAt: new Date() } },
    );

    // 2. Remove from Redis cache
    await redis.client.del(`cart:product:meta:${targetId}`);

    // 3. Remove from active carts
    const affectedCarts = await Cart.find(
      { status: "active", "items.productId": targetId },
      { userId: 1, guestToken: 1 },
    );

    await Cart.updateMany(
      { status: "active", "items.productId": targetId },
      {
        $pull: { items: { productId: targetId } },
        $push: {
          adjustments: {
            itemId: targetId,
            productId: targetId,
            reason: "Product was discontinued or removed from catalog",
            oldQuantity: 1,
            newQuantity: 0,
            createdAt: new Date(),
          },
        },
      },
    );

    for (const c of affectedCarts) {
      await invalidateCartCache({ userId: c.userId, guestToken: c.guestToken });
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "product.deleted",
      aggregateId: targetId,
    });
    logger.info("Removed deleted product from active carts and local snapshot", {
      targetId,
    });
  } catch (err) {
    logger.error(
      "Error processing product.deleted event in cart-service",
      err as Error,
      { targetId },
    );
  }
};

export const handlePriceUpdated = async (payload: {
  productId?: string | number;
  newPrice?: number;
  price?: number;
  [key: string]: unknown;
}): Promise<void> => {
  const targetId = String(payload.productId || payload.id || "");
  const priceValue = payload.newPrice ?? payload.price;

  if (
    !targetId ||
    typeof priceValue !== "number" ||
    isNaN(priceValue) ||
    priceValue < 0
  ) {
    return;
  }

  const eventId = `price_upd_${targetId}_${Date.now()}`;
  const existing = await ProcessedEvent.findOne({ eventId });
  if (existing) return;

  try {
    // 1. Update local ProductSnapshot
    await ProductSnapshot.findOneAndUpdate(
      { productId: targetId },
      { $set: { price: priceValue, updatedAt: new Date() } },
    );

    // 2. Update Redis cache if present
    const cached = await redis.client.get(`cart:product:meta:${targetId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        parsed.price = priceValue;
        await redis.client.set(
          `cart:product:meta:${targetId}`,
          JSON.stringify(parsed),
          "EX",
          86400,
        );
      } catch {}
    }

    // 3. Update active carts
    const affectedCarts = await Cart.find(
      { status: "active", "items.productId": targetId },
      { userId: 1, guestToken: 1 },
    );

    if (affectedCarts.length > 0) {
      const updatedResult = await Cart.updateMany(
        { status: "active", "items.productId": targetId },
        {
          $set: {
            "items.$[elem].unitPrice": priceValue,
            "items.$[elem].subtotal": {
              $multiply: ["$items.$[elem].quantity", priceValue],
            },
          },
        },
        { arrayFilters: [{ "elem.productId": targetId }] },
      );

      for (const c of affectedCarts) {
        await invalidateCartCache({
          userId: c.userId,
          guestToken: c.guestToken,
        });
      }

      logger.info(
        "Refreshed cart prices and local snapshot following pricing.price.updated",
        {
          targetId,
          price: priceValue,
          modifiedCarts: updatedResult.modifiedCount,
        },
      );
    }

    await ProcessedEvent.create({
      eventId,
      eventType: "pricing.price.updated",
      aggregateId: targetId,
    });
  } catch (err) {
    logger.error(
      "Error processing pricing.price.updated event in cart-service",
      err as Error,
      { targetId },
    );
  }
};
