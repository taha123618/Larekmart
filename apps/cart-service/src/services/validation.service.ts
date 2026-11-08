import { cacheRead } from "@repo/redis";
import { type StockAvailabilityCache, buildStockCacheKey } from "@repo/types";
import { ProductSnapshot } from "@repo/cart-db";
import { redis } from "../utils/redis.js";
import { logger } from "../observability/metrics.js";

export interface ValidatedProductInfo {
  productId: string;
  name: string;
  price: number;
  image?: string;
  isActive: boolean;
}

export class ValidationService {
  /**
   * Validates product existence and price using local Redis cache or MongoDB ProductSnapshot.
   * Completely decoupled from product-service (zero synchronous HTTP calls).
   */
  async validateProduct(
    productId: string,
  ): Promise<ValidatedProductInfo | null> {
    try {
      // 1. Sub-millisecond read from Redis cache
      const cacheKey = `cart:product:meta:${productId}`;
      const cached = await redis.client.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ValidatedProductInfo;
          return parsed;
        } catch {
          // ignore parse errors and proceed to DB
        }
      }

      // 2. Fallback to local MongoDB ProductSnapshot
      const snapshot = await ProductSnapshot.findOne({ productId });
      if (snapshot) {
        const info: ValidatedProductInfo = {
          productId: snapshot.productId,
          name: snapshot.name,
          price: snapshot.price,
          image: snapshot.image || "",
          isActive: snapshot.isActive !== false,
        };
        // Backfill Redis cache
        await redis.client
          .set(cacheKey, JSON.stringify(info), "EX", 86400)
          .catch(() => {});
        return info;
      }

      // 3. Fallback: Return null to allow optimistic cart insertion with client-provided details
      logger.debug(
        "Product not found in local snapshot, falling back optimistically",
        { productId },
      );
      return null;
    } catch (err) {
      logger.warn("Error during local product validation in cart-service", {
        productId,
        error: String(err),
      });
      return null;
    }
  }

  /**
   * High-velocity inventory check:
   * 1. Checks Redis stock cache (sub-millisecond, zero DB / HTTP overhead).
   * 2. On cache miss: optimistically allows cart addition (strict stock lease reservation occurs at checkout).
   * Zero synchronous HTTP calls to inventory-service.
   */
  async checkInventoryAvailability(
    productId: string,
    quantity: number,
    variantId?: string,
  ): Promise<{ available: boolean; maxAvailable?: number }> {
    const cacheKey = buildStockCacheKey(productId, variantId);

    // 1. Try reading directly from Redis stock cache
    try {
      const cached = await cacheRead<StockAvailabilityCache>(
        redis.client,
        cacheKey,
      );

      if (cached.status === "hit" && cached.value) {
        const availableQty = cached.value.availableQuantity;
        return {
          available: availableQty >= quantity,
          maxAvailable: availableQty,
        };
      }
    } catch (err) {
      logger.warn(
        "Redis stock cache read error in cart-service; proceeding to optimistic check",
        {
          productId,
          error: String(err),
        },
      );
    }

    // 2. Zero HTTP Fallback: Best-effort inventory check during add-to-cart;
    // strict reservation and stock lease are guaranteed at checkout via RedisStockGatekeeper.
    return { available: true };
  }
}

export const validationService = new ValidationService();
