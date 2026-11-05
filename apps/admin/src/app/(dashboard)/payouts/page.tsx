"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { fetchAdminPayouts, retryAdminPayout } from "@/services/payout.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Banknote,
  CheckCircle2,
  Clock,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  XCircle,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import type { PayoutExecutionStatus } from "@repo/types";

export default function AdminPayoutsPage(): React.JSX.Element {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<
    PayoutExecutionStatus | "ALL"
  >("ALL");

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts-list"],
    queryFn: async () => {
      const token = (await getToken()) || undefined;
      return fetchAdminPayouts(token);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const token = (await getToken()) || undefined;
      return retryAdminPayout(payoutId, token);
    },
    onSuccess: (data) => {
      toast.success(data.message || "Payout retry initiated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-payouts-list"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to retry payout";
      toast.error(msg);
    },
  });

  const payouts = payoutsQuery.data?.payouts || [];

  // Filtered payouts
  const filteredPayouts =
    statusFilter === "ALL"
      ? payouts
      : payouts.filter((p) => p.status === statusFilter);

  // Compute metrics
  const totalVolume = payouts
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const completedCount = payouts.filter((p) => p.status === "COMPLETED").length;
  const processingCount = payouts.filter(
    (p) => p.status === "PROCESSING" || p.status === "SCHEDULED",
  ).length;
  const failedCount = payouts.filter((p) => p.status === "FAILED").length;

  const renderStatusBadge = (status: PayoutExecutionStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            PROCESSING
          </Badge>
        );
      case "SCHEDULED":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            SCHEDULED
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            FAILED
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-zinc-500/10 text-zinc-500 border-zinc-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            CANCELLED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Seller Payouts & Batches
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Authoritative double-entry ledger disbursements, bank
                settlements, and provider reconciliations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({
                queryKey: ["admin-payouts-list"],
              });
              toast.info("Refreshed payout records.");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Disbursed Volume
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              PKR {totalVolume.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Authoritative bank transfers completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Transfers
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully reconciled disbursements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduled & In-Flight
            </CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending clearing network ACK
            </p>
          </CardContent>
        </Card>

        <Card
          className={failedCount > 0 ? "border-rose-500/50 bg-rose-500/5" : ""}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed / Action Required
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${failedCount > 0 ? "text-rose-600" : ""}`}
            >
              {failedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disbursements needing manual retry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b space-x-2 text-sm">
        {(
          ["ALL", "SCHEDULED", "PROCESSING", "COMPLETED", "FAILED"] as const
        ).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`pb-3 px-3 border-b-2 font-medium transition-colors ${
              statusFilter === status
                ? "border-emerald-600 text-emerald-600 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Payouts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Disbursement Registry</CardTitle>
          <CardDescription>
            Individual payout transfers backed by append-only double-entry
            ledger accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payout ID</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Seller ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider Ref</TableHead>
                <TableHead>Failure Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutsQuery.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading payout records...
                  </TableCell>
                </TableRow>
              ) : filteredPayouts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No payouts found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {payout.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payout.batchId || "Ad-hoc"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payout.sellerId}
                    </TableCell>
                    <TableCell className="font-bold text-sm">
                      {payout.currency} {Number(payout.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>{renderStatusBadge(payout.status)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payout.providerReference || "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      {payout.failureReason === "FRAUD_OR_DISPUTE_HOLD" ? (
                        <Link
                          href="/fraud"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                          title="View fraud investigation cases"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-500" />
                          FRAUD/DISPUTE HOLD &rarr;
                        </Link>
                      ) : (
                        <span className="text-rose-500 truncate block">
                          {payout.failureReason || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payout.createdAt
                        ? new Date(payout.createdAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {payout.status === "FAILED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                          onClick={() => retryMutation.mutate(payout.id)}
                          disabled={retryMutation.isPending}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
