import { Hono } from "hono";
import { shouldBeAdmin, shouldBeUser } from "../middleware/authMiddleware.js";
import {
  getPaymentProviderAdapter,
  type SupportedPaymentProvider,
} from "../adapters/payment-provider.adapter.js";
import {
  getCodCollection,
  getReconciliationHistory,
  reconcilePaymentBatch,
  recordCodCollection,
  remitCodCollection,
  validateReconcileBatch,
} from "../services/reconciliation-cod.service.js";

const operationsRoute = new Hono();
const PROVIDERS = new Set<SupportedPaymentProvider>(["STRIPE", "JAZZCASH", "EASYPAISA", "COD"]);

operationsRoute.post("/providers/intent", shouldBeUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = String(body.provider || "").toUpperCase() as SupportedPaymentProvider;
  const orderId = String(body.orderId || "");
  const amount = Number(body.amount);
  if (!PROVIDERS.has(provider) || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return c.json({ message: "Invalid provider intent payload" }, 400);
  }
  const adapter = getPaymentProviderAdapter(provider);
  const result = await adapter.createPaymentIntent({
    orderId,
    userId: c.get("userId"),
    amount,
    currency: String(body.currency || "PKR"),
    metadata: body.metadata as Record<string, string> | undefined,
  });
  return c.json(result, 201);
});

operationsRoute.post("/reconcile", shouldBeAdmin, async (c) => {
  const parsed = validateReconcileBatch(await c.req.json().catch(() => ({})));
  if (!parsed.success || !parsed.data) {
    return c.json({ message: parsed.error || "Invalid reconciliation payload" }, 400);
  }
  const result = reconcilePaymentBatch(parsed.data.records);
  return c.json(result, 200);
});

operationsRoute.get("/reconcile/summary", shouldBeAdmin, async (c) => {
  const history = getReconciliationHistory();
  return c.json({ count: history.length, items: history });
});

operationsRoute.post("/cod/collect", shouldBeAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = String(body.orderId || "");
  const courierId = String(body.courierId || "");
  const expectedAmount = Number(body.expectedAmount);
  const collectedAmount = Number(body.collectedAmount);
  if (!orderId || !courierId || !Number.isFinite(expectedAmount) || expectedAmount <= 0 || !Number.isFinite(collectedAmount) || collectedAmount < 0) {
    return c.json({ message: "Invalid COD collection payload" }, 400);
  }
  const record = recordCodCollection({
    orderId,
    courierId,
    expectedAmount,
    collectedAmount,
    currency: String(body.currency || "PKR"),
    receiptReference: body.receiptReference ? String(body.receiptReference) : undefined,
  });
  return c.json({ record }, 201);
});

operationsRoute.post("/cod/remit", shouldBeAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = String(body.orderId || "");
  const remittedAmount = Number(body.remittedAmount);
  const settlementBatchId = String(body.settlementBatchId || "");
  if (!orderId || !settlementBatchId || !Number.isFinite(remittedAmount) || remittedAmount <= 0) {
    return c.json({ message: "Invalid COD remittance payload" }, 400);
  }
  try {
    const record = remitCodCollection({ orderId, remittedAmount, settlementBatchId });
    return c.json({ record }, 200);
  } catch (err: unknown) {
    return c.json({ message: err instanceof Error ? err.message : "COD remittance failed" }, 409);
  }
});

operationsRoute.get("/cod/:orderId", shouldBeUser, async (c) => {
  const orderId = c.req.param("orderId");
  const record = getCodCollection(orderId);
  if (!record) {
    return c.json({ message: "COD record not found" }, 404);
  }
  return c.json({ record });
});

export default operationsRoute;
