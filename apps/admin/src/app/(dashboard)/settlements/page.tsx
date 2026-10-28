"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchSettlementOverview,
  fetchPayoutBatches,
  generatePayoutBatch,
  approvePayoutBatch,
  sweepMaturedEscrow,
  freezeEscrow,
  type AdminPayoutBatchListItem,
} from "@/services/settlement.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DollarSign,
  Clock,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Coins,
  Send,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";

export default function AdminSettlementsPage(): React.JSX.Element {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // Dialog / Sheet states
  const [selectedBatch, setSelectedBatch] =
    useState<AdminPayoutBatchListItem | null>(null);
  const [bankReference, setBankReference] = useState("");
  const [isFreezeSheetOpen, setIsFreezeSheetOpen] = useState(false);
  const [freezeEscrowId, setFreezeEscrowId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  // Queries
  const {
    data: overview,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["admin-settlements-overview"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchSettlementOverview(token);
    },
  });

  const {
    data: batches = [],
    isLoading: isBatchesLoading,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ["admin-payout-batches"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchPayoutBatches(token);
    },
  });

  // Mutations
  const sweepMutation = useMutation({
    mutationFn: async () => {
      const token = (await getToken()) || undefined;
      return sweepMaturedEscrow(token);
    },
    onSuccess: (res) => {
      toast.success(
        `Maturity sweep completed: ${res.releasedCount} escrow transactions released to available vendor balances.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["admin-settlements-overview"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payout-batches"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Sweep failed";
      toast.error(msg);
    },
  });

  const generateBatchMutation = useMutation({
    mutationFn: async () => {
      const token = (await getToken()) || undefined;
      return generatePayoutBatch(token);
    },
    onSuccess: (batch) => {
      toast.success(
        `Consolidated payout batch #${batch.batchNumber} generated with ${batch.vendorCount} eligible vendors.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["admin-settlements-overview"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payout-batches"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Batch generation failed";
      toast.error(msg);
    },
  });

  const approveBatchMutation = useMutation({
    mutationFn: async ({
      batchId,
      reference,
    }: {
      batchId: string;
      reference?: string;
    }) => {
      const token = (await getToken()) || undefined;
      return approvePayoutBatch(batchId, reference, token);
    },
    onSuccess: (res) => {
      toast.success(
        `Payout batch executed successfully. ${res.disbursedCount} payouts dispatched.`,
      );
      setSelectedBatch(null);
      setBankReference("");
      queryClient.invalidateQueries({
        queryKey: ["admin-settlements-overview"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payout-batches"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Batch approval failed";
      toast.error(msg);
    },
  });

  const freezeMutation = useMutation({
    mutationFn: async ({
      escrowId,
      reason,
    }: {
      escrowId: string;
      reason: string;
    }) => {
      const token = (await getToken()) || undefined;
      return freezeEscrow(escrowId, reason, token);
    },
    onSuccess: () => {
      toast.success("Escrow transaction frozen for administrative review.");
      setIsFreezeSheetOpen(false);
      setFreezeEscrowId("");
      setFreezeReason("");
      queryClient.invalidateQueries({
        queryKey: ["admin-settlements-overview"],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Freeze failed";
      toast.error(msg);
    },
  });

  const renderBatchBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-500 border-amber-500/20"
          >
            Pending Review
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-500 border-blue-500/20"
          >
            Disbursement Processing
          </Badge>
        );
      case "PAID":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          >
            Disbursed & Settled
          </Badge>
        );
      case "FAILED":
      case "REJECTED":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchBatches();
  };

  const isLoading = isOverviewLoading || isBatchesLoading;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Coins className="w-6 h-6 text-indigo-500" />
            Settlement Operations Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide vendor escrow monitoring, return-window maturity
            sweeper, and batch disbursement execution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFreezeSheetOpen(true)}
          >
            <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-500" />
            Freeze Escrow
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending}
          >
            <Clock className="w-4 h-4 mr-1.5 text-amber-500" />
            {sweepMutation.isPending ? "Sweeping..." : "Sweep Matured Escrow"}
          </Button>

          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => generateBatchMutation.mutate()}
            disabled={generateBatchMutation.isPending}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            {generateBatchMutation.isPending
              ? "Generating..."
              : "Generate Payout Batch"}
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Platform Escrow Buffer */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium text-xs">
              <span>Platform Escrow Held</span>
              <Clock className="w-4 h-4" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              PKR{" "}
              {overview
                ? overview.totalPlatformEscrow.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> 7-day
              post-delivery customer return buffer
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Liquid Payout Liabilities */}
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium text-xs">
              <span>Available Payout Liabilities</span>
              <DollarSign className="w-4 h-4" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              PKR{" "}
              {overview
                ? overview.totalAvailablePayoutLiabilities.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Matured
              funds eligible for vendor withdrawal
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Pending Payout Requests */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between font-medium text-xs">
              <span>Pending Payout Requests</span>
              <Send className="w-4 h-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              PKR{" "}
              {overview
                ? overview.pendingPayoutRequestsAmount.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {overview ? overview.pendingPayoutRequestsCount : 0} requested
              withdrawals awaiting batch execution
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Platform Commission Collected */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between font-medium text-xs">
              <span>Platform Commission Earned</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              PKR{" "}
              {overview
                ? overview.totalCommissionCollectedLifetime.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cumulative marketplace platform fee revenue
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Lifetime Disbursed */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between font-medium text-xs">
              <span>Lifetime Disbursed</span>
              <Building2 className="w-4 h-4 text-zinc-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              PKR{" "}
              {overview
                ? overview.totalDisbursedLifetime.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total historical bank and Raast payments settled
            </p>
          </CardContent>
        </Card>

        {/* Card 6: Active Disputed Escrow */}
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium text-xs">
              <span>Disputed & Frozen Funds</span>
              <ShieldAlert className="w-4 h-4" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              PKR{" "}
              {overview
                ? overview.activeDisputedEscrowAmount.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 },
                  )
                : "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {overview ? overview.activeDisputedEscrowCount : 0} transactions
              frozen under inquiry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Disbursement Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            Consolidated Payout Batches
          </CardTitle>
          <CardDescription>
            Review automated batches, inspect gross vs commission deductions,
            and authorize bank disbursements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Gross Volume</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Net Disbursement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      No payout batches have been generated yet. Click
                      &quot;Generate Payout Batch&quot; above to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono font-medium">
                        {b.batchNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(b.periodStart).toLocaleDateString()} –{" "}
                        {new Date(b.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {b.vendorCount} Vendors
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        PKR {b.totalGrossAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-rose-500 text-xs">
                        -PKR {b.totalCommissionDeducted.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                        PKR {b.totalNetAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>{renderBatchBadge(b.status)}</TableCell>
                      <TableCell className="text-right">
                        {b.status === "PENDING_APPROVAL" ? (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            onClick={() => setSelectedBatch(b)}
                          >
                            Authorize Payout
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {b.executedAt
                              ? `Executed ${new Date(b.executedAt).toLocaleDateString()}`
                              : "Archived"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Authorize Payout Batch Modal / Sheet */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Authorize Batch Disbursement
              </h3>
              <button
                onClick={() => setSelectedBatch(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-muted/50 border text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch Number:</span>
                <span className="font-mono font-bold">
                  {selectedBatch.batchNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Participating Merchants:
                </span>
                <span className="font-semibold">
                  {selectedBatch.vendorCount} Vendors
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Total Net Payable:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  PKR {selectedBatch.totalNetAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Bank / Raast Transaction Reference (Optional)
              </label>
              <Input
                placeholder="e.g. HBL-FT-984210948"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Approving this batch immediately transitions vendor payout
                requests to PAID, increments lifetimePaid ledgers, and emits
                settlement completion events.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBatch(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={approveBatchMutation.isPending}
                onClick={() =>
                  approveBatchMutation.mutate({
                    batchId: selectedBatch.id,
                    reference: bankReference.trim() || undefined,
                  })
                }
              >
                {approveBatchMutation.isPending
                  ? "Executing..."
                  : "Authorize & Disburse"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Freeze Escrow Sheet */}
      <Sheet open={isFreezeSheetOpen} onOpenChange={setIsFreezeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              Administrative Escrow Freeze
            </SheetTitle>
            <SheetDescription>
              Place a protective hold on an order transaction to stop maturity
              and prevent funds disbursement.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Escrow Transaction ID (UUID)
              </label>
              <Input
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={freezeEscrowId}
                onChange={(e) => setFreezeEscrowId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Inquiry / Dispute Reason
              </label>
              <Input
                placeholder="e.g. Suspected delivery fraud or merchant policy violation"
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-rose-600 hover:bg-rose-700 text-white mt-4"
              disabled={
                freezeMutation.isPending ||
                !freezeEscrowId.trim() ||
                !freezeReason.trim()
              }
              onClick={() =>
                freezeMutation.mutate({
                  escrowId: freezeEscrowId.trim(),
                  reason: freezeReason.trim(),
                })
              }
            >
              {freezeMutation.isPending
                ? "Freezing..."
                : "Execute Escrow Freeze"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
