import { z } from "zod";

export interface StockTransferRecord {
  transferId: string;
  productId: number;
  variantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason?: string;
  status: "COMPLETED";
  createdAt: string;
}

export interface CycleCountRecord {
  countId: string;
  productId: number;
  variantId: string;
  warehouseId: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  reconciled: boolean;
  countedBy: string;
  createdAt: string;
}

export interface SafetyStockAndExpiryPolicy {
  productId: number;
  variantId: string;
  warehouseId: string;
  safetyStock: number;
  reorderPoint: number;
  reservationExpirySeconds: number;
  flashSaleExpirySeconds: number;
  maxExtensions: number;
  updatedAt: string;
}

export const StockTransferSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export const CycleCountSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  systemQuantity: z.number().int().nonnegative(),
  countedQuantity: z.number().int().nonnegative(),
  reconcile: z.boolean().default(true),
});

export const SafetyStockPolicySchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.string().min(1).default("default"),
  warehouseId: z.string().min(1).default("default"),
  safetyStock: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  reservationExpirySeconds: z.number().int().min(60).max(86400).default(900),
  flashSaleExpirySeconds: z.number().int().min(60).max(3600).default(300),
  maxExtensions: z.number().int().min(0).max(5).default(1),
});

const transferLedger: StockTransferRecord[] = [];
const cycleCountLedger: CycleCountRecord[] = [];
const policyStore = new Map<string, SafetyStockAndExpiryPolicy>();

function policyKey(productId: number, variantId: string, warehouseId: string): string {
  return `${productId}:${variantId}:${warehouseId}`;
}

export function createStockTransferRecord(
  input: z.infer<typeof StockTransferSchema>,
): StockTransferRecord {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Source and destination warehouses must be different");
  }
  const record: StockTransferRecord = {
    transferId: `trf_${crypto.randomUUID().slice(0, 12)}`,
    productId: input.productId,
    variantId: input.variantId,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    quantity: input.quantity,
    reason: input.reason,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
  };
  transferLedger.push(record);
  return record;
}

export function listStockTransfers(): StockTransferRecord[] {
  return transferLedger.slice(-100);
}

export function recordCycleCount(
  input: z.infer<typeof CycleCountSchema>,
  countedBy: string,
): CycleCountRecord {
  const variance = input.countedQuantity - input.systemQuantity;
  const record: CycleCountRecord = {
    countId: `cyc_${crypto.randomUUID().slice(0, 12)}`,
    productId: input.productId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    systemQuantity: input.systemQuantity,
    countedQuantity: input.countedQuantity,
    variance,
    reconciled: input.reconcile,
    countedBy,
    createdAt: new Date().toISOString(),
  };
  cycleCountLedger.push(record);
  return record;
}

export function listCycleCounts(): CycleCountRecord[] {
  return cycleCountLedger.slice(-100);
}

export function upsertSafetyStockPolicy(
  input: z.infer<typeof SafetyStockPolicySchema>,
): SafetyStockAndExpiryPolicy {
  const policy: SafetyStockAndExpiryPolicy = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  policyStore.set(policyKey(input.productId, input.variantId, input.warehouseId), policy);
  return policy;
}

export function getSafetyStockPolicy(
  productId: number,
  variantId = "default",
  warehouseId = "default",
): SafetyStockAndExpiryPolicy {
  return (
    policyStore.get(policyKey(productId, variantId, warehouseId)) ?? {
      productId,
      variantId,
      warehouseId,
      safetyStock: 5,
      reorderPoint: 15,
      reservationExpirySeconds: 900,
      flashSaleExpirySeconds: 300,
      maxExtensions: 1,
      updatedAt: new Date().toISOString(),
    }
  );
}
