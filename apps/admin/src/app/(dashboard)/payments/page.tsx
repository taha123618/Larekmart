"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  fetchReconciliationSummary,
  runPaymentReconciliation,
  recordAdminCodCollection,
  remitAdminCodCollection,
  type ReconciliationResultItem,
} from "@/services/payment.service";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RefreshCw, CheckCircle2, AlertTriangle, Banknote } from "lucide-react";

export default function AdminPaymentsPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<ReconciliationResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // COD form state
  const [codOrderId, setCodOrderId] = useState("");
  const [codCourierId, setCodCourierId] = useState("");
  const [codExpected, setCodExpected] = useState("");
  const [codCollected, setCodCollected] = useState("");
  const [remitBatchId, setRemitBatchId] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = (await getToken()) ?? undefined;
      const res = await fetchReconciliationSummary(token);
      setItems(res.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payment reconciliation summary",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleSampleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    try {
      const token = (await getToken()) ?? undefined;
      const expected = Number(codExpected);
      const settled = Number(codCollected);
      if (!codOrderId || !Number.isFinite(expected) || !Number.isFinite(settled)) {
        setError("Enter valid Order ID, Expected Amount, and Settled/Collected Amount.");
        return;
      }
      const res = await runPaymentReconciliation(
        [
          {
            orderId: codOrderId,
            expectedAmount: expected,
            settledAmount: settled,
            currency: "PKR",
            provider: "STRIPE",
            providerReference: `ref_${codOrderId}`,
          },
        ],
        token,
      );
      setStatusMessage(
        `Reconciled ${res.summary.total} record(s): ${res.summary.matched} matched, discrepancy ${res.summary.totalDiscrepancy}`,
      );
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation failed");
    }
  };

  const handleCodCollect = async () => {
    setError(null);
    setStatusMessage(null);
    try {
      const token = (await getToken()) ?? undefined;
      const record = await recordAdminCodCollection(
        {
          orderId: codOrderId,
          courierId: codCourierId || "TCS",
          expectedAmount: Number(codExpected),
          collectedAmount: Number(codCollected),
          currency: "PKR",
        },
        token,
      );
      setStatusMessage(`COD ${record.orderId} marked ${record.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "COD collection failed");
    }
  };

  const handleCodRemit = async () => {
    setError(null);
    setStatusMessage(null);
    try {
      const token = (await getToken()) ?? undefined;
      const record = await remitAdminCodCollection(
        {
          orderId: codOrderId,
          remittedAmount: Number(codCollected),
          settlementBatchId: remitBatchId || `batch_${Date.now()}`,
        },
        token,
      );
      setStatusMessage(`COD ${record.orderId} updated to ${record.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "COD remittance failed");
    }
  };

  return (
    <div className="space-y-6 p-6 min-w-0 max-w-full w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Payments & COD</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold tracking-tight">
            Payment Reconciliation & COD Lifecycle
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconcile multi-provider settlements and track courier Cash-on-Delivery collections.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Ledger
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form
        onSubmit={handleSampleReconcile}
        className="rounded-xl border bg-card p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="h-4 w-4 text-primary" />
          <span>Reconcile Settlement or Record COD Lifecycle</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            value={codOrderId}
            onChange={(e) => setCodOrderId(e.target.value)}
            placeholder="Order ID"
            className="rounded-md border bg-background px-3 py-2 text-xs"
            required
          />
          <input
            value={codCourierId}
            onChange={(e) => setCodCourierId(e.target.value)}
            placeholder="Courier ID (e.g. TCS)"
            className="rounded-md border bg-background px-3 py-2 text-xs"
          />
          <input
            type="number"
            step="0.01"
            value={codExpected}
            onChange={(e) => setCodExpected(e.target.value)}
            placeholder="Expected Amount"
            className="rounded-md border bg-background px-3 py-2 text-xs"
            required
          />
          <input
            type="number"
            step="0.01"
            value={codCollected}
            onChange={(e) => setCodCollected(e.target.value)}
            placeholder="Settled / Collected Amount"
            className="rounded-md border bg-background px-3 py-2 text-xs"
            required
          />
          <input
            value={remitBatchId}
            onChange={(e) => setRemitBatchId(e.target.value)}
            placeholder="Remit Batch ID"
            className="rounded-md border bg-background px-3 py-2 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Run Reconciliation
          </button>
          <button
            type="button"
            onClick={handleCodCollect}
            className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            Record COD Collection
          </button>
          <button
            type="button"
            onClick={handleCodRemit}
            className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            Remit COD Batch
          </button>
        </div>
      </form>

      <div className="rounded-xl border bg-card overflow-x-auto min-w-full">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 font-semibold min-w-[140px]">Order ID</th>
              <th className="p-3 font-semibold min-w-[110px]">Provider</th>
              <th className="p-3 font-semibold min-w-[110px]">Expected</th>
              <th className="p-3 font-semibold min-w-[110px]">Settled</th>
              <th className="p-3 font-semibold min-w-[110px]">Discrepancy</th>
              <th className="p-3 font-semibold min-w-[140px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Loading reconciliation records...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No reconciliation records recorded yet.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={`${item.orderId}-${idx}`}>
                  <td className="p-3 font-mono">{item.orderId}</td>
                  <td className="p-3">{item.provider}</td>
                  <td className="p-3">
                    {item.expectedAmount.toFixed(2)} {item.currency}
                  </td>
                  <td className="p-3">
                    {item.settledAmount.toFixed(2)} {item.currency}
                  </td>
                  <td className="p-3 font-mono">{item.discrepancyAmount.toFixed(2)}</td>
                  <td className="p-3 font-semibold">{item.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
