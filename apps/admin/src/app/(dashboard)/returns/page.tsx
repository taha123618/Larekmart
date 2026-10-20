"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  fetchAdminReturns,
  fetchAdminReturnDetails,
  approveReturn,
  rejectReturn,
  recordReturnInspection,
  retryReturnRefund,
  calculateReturnOverviewKPIs,
  AdminReturnRecord,
} from "@/services/return.service";
import { ReturnOverviewCards } from "@/components/returns/ReturnOverviewCards";
import { ReturnTable } from "@/components/returns/ReturnTable";
import { ReturnDetailsModal } from "@/components/returns/ReturnDetailsModal";
import { InspectionModal } from "@/components/returns/InspectionModal";
import { ApproveRejectDialog } from "@/components/returns/ApproveRejectDialog";
import { RotateCcw, RefreshCw } from "lucide-react";

export default function ReturnsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedRecord, setSelectedRecord] = useState<AdminReturnRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Approve / Reject state
  const [actionReturnId, setActionReturnId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"APPROVE" | "REJECT" | null>(null);

  // Inspection state
  const [inspectRecord, setInspectRecord] = useState<AdminReturnRecord | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  // Active status filter
  const [activeFilter, setActiveFilter] = useState("ALL");

  // Query: Returns list
  const {
    data: returns = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminReturns(token || undefined);
    },
  });

  const kpis = calculateReturnOverviewKPIs(returns);

  // Mutation: Approve
  const approveMutation = useMutation({
    mutationFn: async ({
      returnId,
      providePrepaidLabel,
      notes,
    }: {
      returnId: string;
      providePrepaidLabel: boolean;
      notes?: string;
    }) => {
      const token = await getToken();
      return approveReturn(returnId, { providePrepaidLabel, notes }, token || undefined);
    },
    onSuccess: (data) => {
      toast.success(`Return #${data.returnId.slice(0, 8)} approved successfully!`);
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      if (selectedRecord?.id === data.returnId) {
        setIsDetailsOpen(false);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve return");
    },
  });

  // Mutation: Reject
  const rejectMutation = useMutation({
    mutationFn: async ({
      returnId,
      reason,
    }: {
      returnId: string;
      reason: string;
    }) => {
      const token = await getToken();
      return rejectReturn(returnId, reason, token || undefined);
    },
    onSuccess: (data) => {
      toast.info(`Return #${data.returnId.slice(0, 8)} has been rejected.`);
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      if (selectedRecord?.id === data.returnId) {
        setIsDetailsOpen(false);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject return");
    },
  });

  // Mutation: Record Inspection
  const inspectMutation = useMutation({
    mutationFn: async ({
      returnId,
      payload,
    }: {
      returnId: string;
      payload: {
        overallCondition: string;
        items: Array<{
          returnItemId: string;
          receivedCondition: string;
          disposition: string;
          notes?: string;
        }>;
        notes?: string;
      };
    }) => {
      const token = await getToken();
      return recordReturnInspection(returnId, payload, token || undefined);
    },
    onSuccess: (data) => {
      toast.success(`Inspection recorded! Return #${data.returnId.slice(0, 8)} moved to REFUND_PENDING`);
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      if (selectedRecord?.id === data.returnId) {
        setIsDetailsOpen(false);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record inspection");
    },
  });

  // Mutation: Retry Refund
  const retryRefundMutation = useMutation({
    mutationFn: async (returnId: string) => {
      const token = await getToken();
      return retryReturnRefund(returnId, token || undefined);
    },
    onSuccess: (data) => {
      toast.success(`Refund SAGA re-triggered for return #${data.returnId.slice(0, 8)}`);
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to retry refund");
    },
  });

  // Handlers
  const handleViewDetails = async (record: AdminReturnRecord) => {
    try {
      const token = await getToken();
      const detailed = await fetchAdminReturnDetails(record.id, token || undefined);
      setSelectedRecord(detailed);
      setIsDetailsOpen(true);
    } catch {
      setSelectedRecord(record);
      setIsDetailsOpen(true);
    }
  };

  const handleOpenApprove = (returnId: string) => {
    setActionReturnId(returnId);
    setActionMode("APPROVE");
  };

  const handleOpenReject = (returnId: string) => {
    setActionReturnId(returnId);
    setActionMode("REJECT");
  };

  const handleOpenInspect = async (returnId: string) => {
    const record = returns.find((r) => r.id === returnId);
    if (record) {
      try {
        const token = await getToken();
        const detailed = await fetchAdminReturnDetails(returnId, token || undefined);
        setInspectRecord(detailed);
      } catch {
        setInspectRecord(record);
      }
      setIsInspectOpen(true);
    }
  };

  const handleRetryRefund = (returnId: string) => {
    if (confirm("Are you sure you want to retry the Stripe refund for this return?")) {
      retryRefundMutation.mutate(returnId);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Return & Refund Operations
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review customer return requests, inspect received shipments, and coordinate refund disbursements.
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-indigo-500" : ""}`} />
          <span>Refresh Operations</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <ReturnOverviewCards
        kpis={kpis}
        activeFilter={activeFilter}
        onFilterSelect={(status) => setActiveFilter(status)}
      />

      {/* Main Table */}
      <ReturnTable
        returns={returns}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        onApprove={handleOpenApprove}
        onReject={handleOpenReject}
        onInspect={handleOpenInspect}
        onRetryRefund={handleRetryRefund}
      />

      {/* Details Sheet / Modal */}
      <ReturnDetailsModal
        returnRecord={selectedRecord}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onApprove={handleOpenApprove}
        onReject={handleOpenReject}
        onInspect={handleOpenInspect}
        onRetryRefund={handleRetryRefund}
      />

      {/* Approve / Reject Dialog */}
      <ApproveRejectDialog
        returnId={actionReturnId}
        mode={actionMode}
        isOpen={!!actionMode}
        onClose={() => {
          setActionReturnId(null);
          setActionMode(null);
        }}
        onConfirmApprove={async (id, prepaid, notes) => {
          await approveMutation.mutateAsync({
            returnId: id,
            providePrepaidLabel: prepaid,
            notes,
          });
        }}
        onConfirmReject={async (id, reason) => {
          await rejectMutation.mutateAsync({ returnId: id, reason });
        }}
      />

      {/* Warehouse Inspection Modal */}
      <InspectionModal
        returnRecord={inspectRecord}
        isOpen={isInspectOpen}
        onClose={() => {
          setInspectRecord(null);
          setIsInspectOpen(false);
        }}
        onSubmit={async (payload) => {
          if (inspectRecord) {
            await inspectMutation.mutateAsync({
              returnId: inspectRecord.id,
              payload,
            });
          }
        }}
      />
    </div>
  );
}
