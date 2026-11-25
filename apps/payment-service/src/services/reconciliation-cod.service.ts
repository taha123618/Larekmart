export interface ReconciliationInputRecord {
  orderId: string;
  expectedAmount: number;
  settledAmount: number;
  currency: string;
  provider: string;
  providerReference: string;
}

export interface ReconciliationResultItem extends ReconciliationInputRecord {
  status: "MATCHED" | "UNDERPAID" | "OVERPAID" | "MISSING_SETTLEMENT";
  discrepancyAmount: number;
  reconciledAt: string;
}

export type CodStatus =
  | "PENDING_COLLECTION"
  | "COLLECTED_BY_COURIER"
  | "REMITTED_TO_MARKETPLACE"
  | "DISPUTED";

export interface CodCollectionRecord {
  orderId: string;
  courierId: string;
  expectedAmount: number;
  collectedAmount: number;
  remittedAmount: number;
  currency: string;
  status: CodStatus;
  collectedAt?: string;
  remittedAt?: string;
  receiptReference?: string;
}

export function validateReconcileBatch(body: unknown): {
  success: boolean;
  data?: { records: ReconciliationInputRecord[] };
  error?: string;
} {
  const b = body as { records?: unknown[] } | null;
  if (!b || !Array.isArray(b.records) || b.records.length === 0) {
    return { success: false, error: "records must be a non-empty array" };
  }
  const records: ReconciliationInputRecord[] = [];
  for (const r of b.records) {
    const rec = r as Record<string, unknown>;
    if (!rec?.orderId || typeof rec.expectedAmount !== "number" || typeof rec.settledAmount !== "number") {
      return { success: false, error: "Each record requires orderId, expectedAmount, and settledAmount" };
    }
    records.push({
      orderId: String(rec.orderId),
      expectedAmount: rec.expectedAmount,
      settledAmount: rec.settledAmount,
      currency: String(rec.currency || "PKR"),
      provider: String(rec.provider || "STRIPE"),
      providerReference: String(rec.providerReference || ""),
    });
  }
  return { success: true, data: { records } };
}

const reconciliationHistory: ReconciliationResultItem[] = [];
const codLedger = new Map<string, CodCollectionRecord>();

export function reconcilePaymentBatch(
  records: ReconciliationInputRecord[],
): {
  items: ReconciliationResultItem[];
  summary: {
    total: number;
    matched: number;
    underpaid: number;
    overpaid: number;
    missingSettlement: number;
    totalDiscrepancy: number;
  };
} {
  const now = new Date().toISOString();
  const items: ReconciliationResultItem[] = records.map((rec) => {
    const diff = Number((rec.settledAmount - rec.expectedAmount).toFixed(2));
    let status: ReconciliationResultItem["status"] = "MATCHED";
    if (rec.settledAmount === 0 && rec.expectedAmount > 0) {
      status = "MISSING_SETTLEMENT";
    } else if (diff < -0.01) {
      status = "UNDERPAID";
    } else if (diff > 0.01) {
      status = "OVERPAID";
    }

    const item: ReconciliationResultItem = {
      ...rec,
      status,
      discrepancyAmount: diff,
      reconciledAt: now,
    };
    reconciliationHistory.push(item);
    return item;
  });

  const summary = {
    total: items.length,
    matched: items.filter((i) => i.status === "MATCHED").length,
    underpaid: items.filter((i) => i.status === "UNDERPAID").length,
    overpaid: items.filter((i) => i.status === "OVERPAID").length,
    missingSettlement: items.filter((i) => i.status === "MISSING_SETTLEMENT").length,
    totalDiscrepancy: Number(
      items.reduce((acc, i) => acc + i.discrepancyAmount, 0).toFixed(2),
    ),
  };

  return { items, summary };
}

export function getReconciliationHistory(): ReconciliationResultItem[] {
  return reconciliationHistory.slice(-100);
}

export function recordCodCollection(input: {
  orderId: string;
  courierId: string;
  expectedAmount: number;
  collectedAmount: number;
  currency: string;
  receiptReference?: string;
}): CodCollectionRecord {
  const isShort = input.collectedAmount + 0.01 < input.expectedAmount;
  const record: CodCollectionRecord = {
    orderId: input.orderId,
    courierId: input.courierId,
    expectedAmount: input.expectedAmount,
    collectedAmount: input.collectedAmount,
    remittedAmount: 0,
    currency: input.currency,
    status: isShort ? "DISPUTED" : "COLLECTED_BY_COURIER",
    collectedAt: new Date().toISOString(),
    receiptReference: input.receiptReference,
  };
  codLedger.set(input.orderId, record);
  return record;
}

export function remitCodCollection(input: {
  orderId: string;
  remittedAmount: number;
  settlementBatchId: string;
}): CodCollectionRecord {
  const existing = codLedger.get(input.orderId);
  if (!existing) {
    throw new Error(`No COD collection found for order ${input.orderId}`);
  }
  if (existing.status === "DISPUTED") {
    throw new Error(`Cannot remit disputed COD collection for order ${input.orderId}`);
  }

  existing.remittedAmount = input.remittedAmount;
  existing.remittedAt = new Date().toISOString();
  existing.receiptReference = input.settlementBatchId;
  existing.status =
    input.remittedAmount + 0.01 < existing.collectedAmount
      ? "DISPUTED"
      : "REMITTED_TO_MARKETPLACE";

  codLedger.set(input.orderId, existing);
  return existing;
}

export function getCodCollection(orderId: string): CodCollectionRecord | null {
  return codLedger.get(orderId) ?? null;
}
