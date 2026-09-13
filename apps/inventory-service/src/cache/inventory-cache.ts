import {
  bumpNamespaceVersion,
  cacheRead,
  cacheSet,
  getNamespaceVersion,
} from "@repo/redis";
import type { InventoryItem } from "@repo/inventory-db";
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
}

export async function invalidateInventoryCache(): Promise<void> {
  await bumpNamespaceVersion(redis.client, versionKey, namespaceFallback);
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
