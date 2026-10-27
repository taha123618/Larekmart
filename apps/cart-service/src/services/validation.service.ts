import { cacheRead, cacheSet } from "@repo/redis";
import { type StockAvailabilityCache, buildStockCacheKey } from "@repo/types";
import { redis } from "../utils/redis.js";
import { env } from "../config/env.js";
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
   * Gracefully validates product existence and current price from product-service
   */
  async validateProduct(
    productId: string,
  ): Promise<ValidatedProductInfo | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(
        `${env.PRODUCT_SERVICE_URL}/products/${encodeURIComponent(productId)}`,
        {
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn("Product not found during cart validation", {
          productId,
          status: res.status,
        });
        return null;
      }

      const product = (await res.json()) as any;
      return {
        productId: product.id || productId,
        name: product.name || "Product",
        price: typeof product.price === "number" ? product.price : 0,
        image:
          Array.isArray(product.images) && product.images.length > 0
            ? product.images[0]
            : "",
        isActive: true,
      };
    } catch (err) {
      logger.warn(
        "Product-service call timed out or failed; falling back to optimistic validation",
        {
          productId,
          error: String(err),
        },
      );
      // Resilient fallback: allow cart insertion with provided client details if catalog service is down
      return null;
    }
  }

  /**
   * High-velocity inventory check:
   * 1. Checks Redis stock cache (sub-millisecond, zero DB / HTTP overhead).
   * 2. On cache miss: falls back to inventory-service HTTP and backfills Redis.
   * 3. On error or timeout: gracefully falls back optimistically (strict reservations happen at checkout).
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
        "Redis stock cache read error in cart-service; proceeding to fallback",
        {
          productId,
          error: String(err),
        },
      );
    }

    // 2. Fallback to inventory-service HTTP on cache miss
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(
        `${env.INVENTORY_SERVICE_URL}/api/v1/inventory/${encodeURIComponent(productId)}/availability`,
        {
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        return { available: true }; // Optimistic fallback if service unreachable
      }

      const data = (await res.json()) as any;
      const totalAvailable =
        typeof data.availableQuantity === "number"
          ? data.availableQuantity
          : 999;

      // Backfill Redis stock cache for subsequent add-to-cart operations
      const stockPayload: StockAvailabilityCache = {
        productId: Number(productId) || 0,
        variantId: variantId ?? null,
        availableQuantity: totalAvailable,
        status:
          totalAvailable === 0
            ? "OUT_OF_STOCK"
            : totalAvailable <= 5
              ? "LOW_STOCK"
              : "IN_STOCK",
        updatedAt: new Date().toISOString(),
      };
      await cacheSet(redis.client, cacheKey, stockPayload, 900).catch(() => {});

      return {
        available: totalAvailable >= quantity,
        maxAvailable: totalAvailable,
      };
    } catch {
      // Best-effort inventory check during add-to-cart; strict reservation happens at checkout
      return { available: true };
    }
  }
}

export const validationService = new ValidationService();
