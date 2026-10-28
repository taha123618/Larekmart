"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  RefreshCw,
  Search,
  Scale,
  ExternalLink,
} from "lucide-react";
import {
  fetchAdminDisputes,
  fetchAdminDisputesOverview,
} from "@/services/dispute.service";
import type {
  DisputeResponse,
  DisputesOverview,
  DisputeStatus,
} from "@repo/types";
import ArbitrationDrawer from "@/components/disputes/ArbitrationDrawer";

export default function DisputesDashboardPage(): React.JSX.Element {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [overview, setOverview] = useState<DisputesOverview | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<DisputeResponse | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;

      const [disputesRes, overviewRes] = await Promise.all([
        fetchAdminDisputes(token, {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
          page: 1,
          limit: 50,
        }),
        fetchAdminDisputesOverview(token),
      ]);

      setDisputes(disputesRes.disputes);
      setOverview(overviewRes);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load dispute records",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter, searchQuery]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
    }
  }, [isLoaded, isSignedIn, loadData]);

  const handleOpenArbitration = (dispute: DisputeResponse) => {
    setSelectedDispute(dispute);
    setIsDrawerOpen(true);
  };

  const formatCurrency = (amt: number, curr = "PKR") => {
    return `${curr} ${amt.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusBadge = (status: DisputeStatus) => {
    switch (status) {
      case "OPENED":
      case "EVIDENCE_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            Awaiting Seller Rebuttal
          </span>
        );
      case "EVIDENCE_SUBMITTED":
      case "ARBITRATION":
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Clock className="w-3 h-3" />
            Ready for Arbitration
          </span>
        );
      case "RESOLVED_SELLER_FAVOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Seller Won
          </span>
        );
      case "RESOLVED_BUYER_FAVOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            Buyer Refunded
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Disputes & Arbitration Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Escrow Protection
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Resolve buyer inquiries, review merchant proof of delivery, and arbitrate frozen escrow funds.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-3">
            <span>Total Inquiries</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {overview?.totalDisputes || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Platform-wide filed disputes</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-bold mb-3">
            <span>Pending Rebuttal</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {(overview?.openCount || 0) + (overview?.evidenceRequestedCount || 0)}
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
            Seller 7-day countdown active
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs font-bold mb-3">
            <span>Ready for Arbitration</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {(overview?.underReviewCount || 0) + (overview?.arbitrationCount || 0)}
          </div>
          <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1">
            Rebuttal submitted; awaiting verdict
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-3">
            <span>Disputed Escrow Value</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(overview?.totalDisputedAmount || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Frozen liabilities</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Dispute #, Order ID, or reason..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "ALL", label: "All" },
            { key: "OPENED", label: "Needs Rebuttal" },
            { key: "EVIDENCE_SUBMITTED", label: "Evidence In" },
            { key: "RESOLVED_BUYER_FAVOR", label: "Buyer Won" },
            { key: "RESOLVED_SELLER_FAVOR", label: "Seller Won" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === tab.key
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            Loading disputes table...
          </div>
        ) : disputes.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Zero Active Disputes
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              All marketplace orders are fulfilling smoothly without open buyer claims.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-4 px-6">Dispute #</th>
                  <th className="py-4 px-6">Order ID</th>
                  <th className="py-4 px-6">Claim Type</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Filed At</th>
                  <th className="py-4 px-6 text-right">Arbitration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">
                      {d.disputeNumber}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-400">
                      #{d.orderId}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {d.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(d.disputedAmount, d.currency)}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(d.status)}</td>
                    <td className="py-4 px-6 text-slate-500">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenArbitration(d)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        Inspect & Arbitrate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Arbitration Drawer */}
      {selectedDispute && (
        <ArbitrationDrawer
          dispute={selectedDispute}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedDispute(null);
          }}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}

