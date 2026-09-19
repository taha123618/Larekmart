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
   * Gracefully checks available inventory from inventory-service
   */
  async checkInventoryAvailability(
    productId: string,
    quantity: number,
  ): Promise<{ available: boolean; maxAvailable?: number }> {
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
