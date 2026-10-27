import {
  bumpNamespaceVersion,
  cacheRead,
  cacheSet,
  cacheDel,
  getNamespaceVersion,
} from "@repo/redis";
import type { InventoryItem } from "@repo/inventory-db";
import { type StockAvailabilityCache, buildStockCacheKey } from "@repo/types";
import { cacheMetrics } from "../observability/metrics.js";
import {
  inventoryCacheTtlSeconds,
  namespaceFallback,
  redis,
} from "../utils/redis.js";

export interface InventoryAvailability {
  productId: number;
  variantId?: string;
  warehouseId?: string;
  warehouses: Array<{
    warehouseId: string;
    availableQuantity: number;
    reservedQuantity: number;
    soldQuantity: number;
    status: string;
  }>;
  availableQuantity: number;
}

const versionKey = redis.keys.simple("namespace_version");

function cacheKey(
  productId: number,
  variantId?: string,
  warehouseId?: string,
): string {
  const version = namespaceFallback.value;
  return redis.keys.namespace(
    "v",
    version,
    "availability",
    productId,
    variantId ?? "all",
    warehouseId ?? "all",
  );
}

export async function readAvailability(
  productId: number,
  variantId?: string,
  warehouseId?: string,
): Promise<InventoryAvailability | null> {
  await getNamespaceVersion(redis.client, versionKey, namespaceFallback);
  const result = await cacheRead<InventoryAvailability>(
    redis.client,
    cacheKey(productId, variantId, warehouseId),
  );
  return cacheMetrics.record(result, "inventory-availability");
}

export async function writeAvailability(
  availability: InventoryAvailability,
): Promise<void> {
  await cacheSet(
    redis.client,
    cacheKey(
      availability.productId,
      availability.variantId,
      availability.warehouseId,
    ),
    availability,
    inventoryCacheTtlSeconds,
  );

  // Synchronize centralized cross-service Redis key for cart-service & gateway edge
  try {
    const centralizedKey = buildStockCacheKey(
      availability.productId,
      availability.variantId,
    );
    const stockPayload: StockAvailabilityCache = {
      productId: availability.productId,
      variantId: availability.variantId ?? null,
      availableQuantity: availability.availableQuantity,
      status:
        availability.availableQuantity === 0
          ? "OUT_OF_STOCK"
          : availability.availableQuantity <= 5
            ? "LOW_STOCK"
            : "IN_STOCK",
      updatedAt: new Date().toISOString(),
    };
    await cacheSet(redis.client, centralizedKey, stockPayload, 900); // 15-minute rolling TTL
  } catch {
    // Non-blocking degradation
  }
}

export async function writeCentralizedStockCache(
  productId: number,
  availableQuantity: number,
  variantId?: string | null,
): Promise<void> {
  try {
    const centralizedKey = buildStockCacheKey(productId, variantId);
    const stockPayload: StockAvailabilityCache = {
      productId,
      variantId: variantId ?? null,
      availableQuantity,
      status:
        availableQuantity === 0
          ? "OUT_OF_STOCK"
          : availableQuantity <= 5
            ? "LOW_STOCK"
            : "IN_STOCK",
      updatedAt: new Date().toISOString(),
    };
    await cacheSet(redis.client, centralizedKey, stockPayload, 900);
  } catch {
    // Non-blocking degradation
  }
}

export async function invalidateInventoryCache(
  productId?: number,
  variantId?: string,
): Promise<void> {
  await bumpNamespaceVersion(redis.client, versionKey, namespaceFallback);
  if (productId) {
    try {
      const centralizedKey = buildStockCacheKey(productId, variantId);
      await cacheDel(redis.client, centralizedKey);
    } catch {
      // Non-blocking
    }
  }
}

export function availabilityFromItems(
  productId: number,
  items: InventoryItem[],
  variantId?: string,
  warehouseId?: string,
): InventoryAvailability {
  return {
    productId,
    variantId,
    warehouseId,
    warehouses: items.map((item) => ({
      warehouseId: item.warehouseId,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      soldQuantity: item.soldQuantity,
      status: item.status,
    })),
    availableQuantity: items.reduce(
      (total, item) => total + item.availableQuantity,
      0,
    ),
  };
}
