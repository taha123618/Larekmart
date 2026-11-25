import { Hono } from "hono";
import { shouldBeSellerOrAdmin } from "../middleware/authMiddleware.js";
import {
  CycleCountSchema,
  SafetyStockPolicySchema,
  StockTransferSchema,
  createStockTransferRecord,
  getSafetyStockPolicy,
  listCycleCounts,
  listStockTransfers,
  recordCycleCount,
  upsertSafetyStockPolicy,
} from "../services/inventory-operations.service.js";

const inventoryOperationsRoute = new Hono();

inventoryOperationsRoute.post("/transfers", shouldBeSellerOrAdmin, async (c) => {
  const parsed = StockTransferSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ message: "Invalid stock transfer payload", issues: parsed.error.issues }, 400);
  }
  try {
    const transfer = createStockTransferRecord(parsed.data);
    return c.json({ data: transfer }, 201);
  } catch (err: unknown) {
    return c.json({ message: err instanceof Error ? err.message : "Transfer failed" }, 400);
  }
});

inventoryOperationsRoute.get("/transfers", shouldBeSellerOrAdmin, (c) => {
  return c.json({ data: listStockTransfers() });
});

inventoryOperationsRoute.post("/cycle-counts", shouldBeSellerOrAdmin, async (c) => {
  const parsed = CycleCountSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ message: "Invalid cycle count payload", issues: parsed.error.issues }, 400);
  }
  const countedBy = (c.get as any)("userId") || "system";
  const record = recordCycleCount(parsed.data, countedBy);
  return c.json({ data: record }, 201);
});

inventoryOperationsRoute.get("/cycle-counts", shouldBeSellerOrAdmin, (c) => {
  return c.json({ data: listCycleCounts() });
});

inventoryOperationsRoute.put("/safety-stock", shouldBeSellerOrAdmin, async (c) => {
  const parsed = SafetyStockPolicySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ message: "Invalid safety stock policy payload", issues: parsed.error.issues }, 400);
  }
  const policy = upsertSafetyStockPolicy(parsed.data);
  return c.json({ data: policy }, 200);
});

inventoryOperationsRoute.get("/safety-stock/:productId", shouldBeSellerOrAdmin, (c) => {
  const productId = Number(c.req.param("productId"));
  if (!Number.isInteger(productId) || productId <= 0) {
    return c.json({ message: "Invalid productId" }, 400);
  }
  const variantId = c.req.query("variantId") || "default";
  const warehouseId = c.req.query("warehouseId") || "default";
  return c.json({ data: getSafetyStockPolicy(productId, variantId, warehouseId) });
});

export default inventoryOperationsRoute;
