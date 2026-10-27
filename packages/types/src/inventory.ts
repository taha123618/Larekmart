import { z } from "zod";

export const InventoryMovementTypeEnum = z.enum([
  "PURCHASE",
  "RESTOCK",
  "RESERVE",
  "RELEASE",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "DAMAGE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

export const InventoryProductParamsSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const InventoryLookupQuerySchema = z.object({
  variantId: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
});

export const InventoryReservationSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  referenceType: z.string().min(1).max(100),
  referenceId: z.string().min(1).max(200),
  expiresAt: z.coerce.date(),
});

export const InventoryReservationIdSchema = z.object({
  id: z.string().min(1),
});

export const InventoryAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, {
      message: "quantityDelta must be a non-zero integer",
    }),
  movementType: z
    .enum(["ADJUSTMENT", "DAMAGE", "RESTOCK", "RETURN", "PURCHASE"])
    .default("ADJUSTMENT"),
  reason: z.string().max(500).optional(),
  referenceType: z.string().max(100).optional(),
  referenceId: z.string().max(200).optional(),
});

export const InventoryRestockSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  referenceType: z.string().max(100).optional(),
  referenceId: z.string().max(200).optional(),
});

export const InventoryListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const InventoryItemsQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  variantId: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
  status: z
    .enum(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "INACTIVE"])
    .optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const InventoryMovementQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  variantId: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
  type: InventoryMovementTypeEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).default(50),
  cursor: z.string().optional(),
});

export type InventoryMovementType = z.infer<typeof InventoryMovementTypeEnum>;
export type InventoryReservationInput = z.infer<
  typeof InventoryReservationSchema
>;
export type InventoryAdjustmentInput = z.infer<
  typeof InventoryAdjustmentSchema
>;
export type InventoryRestockInput = z.infer<typeof InventoryRestockSchema>;
export type InventoryMovementQuery = z.infer<
  typeof InventoryMovementQuerySchema
>;

export interface InventoryChangedPayload {
  inventoryItemId: string;
  productId: number;
  variantId: string;
  warehouseId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  reservationId?: string;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  occurredAt: string;
}

export interface InventoryReservationFailedPayload {
  reservationId: string;
  referenceId?: string | null;
  productId?: number;
  variantId?: string;
  reason:
    | "EXPIRED"
    | "INSUFFICIENT_STOCK"
    | "NOT_FOUND"
    | "VERIFICATION_REJECTED";
  details?: string;
  occurredAt: string;
}

export interface StockAvailabilityCache {
  productId: number;
  variantId?: string | null;
  availableQuantity: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  updatedAt: string;
}

export function buildStockCacheKey(
  productId: number | string,
  variantId?: string | null,
): string {
  if (variantId && variantId !== "all") {
    return `stock:product:${productId}:variant:${variantId}`;
  }
  return `stock:product:${productId}`;
}

export interface InventoryReservationCancelledPayload {
  orderId?: string;
  reservationId?: string | null;
  referenceId?: string | null;
  reason: string;
  cancelledAt: string;
}
