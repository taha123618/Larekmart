import { z } from "zod";

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
    .refine((value) => value !== 0),
  movementType: z.enum(["ADJUSTMENT", "DAMAGE"]),
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

export type InventoryReservationInput = z.infer<
  typeof InventoryReservationSchema
>;
export type InventoryAdjustmentInput = z.infer<
  typeof InventoryAdjustmentSchema
>;
export type InventoryRestockInput = z.infer<typeof InventoryRestockSchema>;

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
