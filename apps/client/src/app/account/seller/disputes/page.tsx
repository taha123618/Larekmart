"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
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
  ChevronLeft,
  Store,
  ExternalLink,
} from "lucide-react";
import { getMyVendor, type ClientVendor } from "@/services/vendor.service";
import {
  fetchVendorDisputes,
  fetchVendorDisputesOverview,
} from "@/services/dispute.service";
import type {
  DisputeResponse,
  DisputesOverview,
  DisputeStatus,
} from "@repo/types";
import DisputeRebuttalModal from "@/components/seller/DisputeRebuttalModal";

export default function MerchantDisputesPage(): React.JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<ClientVendor | null>(null);
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [overview, setOverview] = useState<DisputesOverview | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "ALL">("ALL");
  const [selectedDispute, setSelectedDispute] = useState<DisputeResponse | null>(null);
  const [isRebuttalModalOpen, setIsRebuttalModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const myVendor = await getMyVendor(token);
      if (!myVendor) {
        setVendor(null);
        return;
      }
      setVendor(myVendor);

      const [disputesRes, overviewRes] = await Promise.all([
        fetchVendorDisputes(
          myVendor.id,
          statusFilter === "ALL" ? undefined : statusFilter,
          1,
          50,
          token,
        ),
        fetchVendorDisputesOverview(myVendor.id, token),
      ]);

      setDisputes(disputesRes.disputes);
      setOverview(overviewRes);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load dispute data",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
    }
  }, [isLoaded, isSignedIn, loadData]);

  const handleOpenRebuttal = (dispute: DisputeResponse) => {
    setSelectedDispute(dispute);
    setIsRebuttalModalOpen(true);
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
            Action Required
          </span>
        );
      case "EVIDENCE_SUBMITTED":
      case "ARBITRATION":
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Clock className="w-3 h-3" />
            In Arbitration
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

  const getDeadlineText = (deadlineStr?: string | Date | null) => {
    if (!deadlineStr) return "None";
    const d = new Date(deadlineStr);
    const now = new Date();
    const diffHours = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return <span className="text-rose-600 font-bold">Expired</span>;
    }
    if (diffHours < 24) {
      return (
        <span className="text-rose-600 font-bold">
          {diffHours} hours remaining
        </span>
      );
    }
    const days = Math.round(diffHours / 24);
    return (
      <span className="text-amber-600 font-semibold">{days} days remaining</span>
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mb-4" />
        <p className="text-sm text-slate-500 font-medium">
          Loading merchant disputes & arbitration records...
        </p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          No Verified Merchant Account
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          You need an active merchant vendor profile to manage disputes and settlement funds.
        </p>
        <Link
          href="/become-a-seller"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition"
        >
          Complete Vendor Onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Account Overview
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Disputes & Chargeback Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Escrow Protection
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Merchant: <span className="font-bold text-slate-700 dark:text-slate-300">{vendor.legalName}</span>
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

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Disputes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-3">
            <span>Total Disputes</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {overview?.totalDisputes || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Lifetime customer inquiries & claims</p>
        </div>

        {/* Action Required */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-bold mb-3">
            <span>Action Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {(overview?.openCount || 0) + (overview?.evidenceRequestedCount || 0)}
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
            Rebuttal window active (7-day deadline)
          </p>
        </div>

        {/* In Arbitration */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-3">
            <span>In Arbitration</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {(overview?.underReviewCount || 0) + (overview?.arbitrationCount || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Counter-evidence under platform review</p>
        </div>

        {/* Disputed Volume */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-3">
            <span>Total Disputed Amount</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(overview?.totalDisputedAmount || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Held in dispute freeze</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: "ALL", label: "All Claims" },
          { key: "OPENED", label: "Needs Response" },
          { key: "EVIDENCE_SUBMITTED", label: "Evidence Submitted" },
          { key: "RESOLVED_SELLER_FAVOR", label: "Won (Seller)" },
          { key: "RESOLVED_BUYER_FAVOR", label: "Lost (Buyer)" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              statusFilter === tab.key
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Disputes Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
        {disputes.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Disputes Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Your store has an outstanding fulfillment record with zero active buyer claims.
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
                  <th className="py-4 px-6">Disputed Amount</th>
                  <th className="py-4 px-6">Rebuttal Deadline</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Action</th>
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
                    <td className="py-4 px-6">
                      {getDeadlineText(d.rebuttalDeadline)}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(d.status)}</td>
                    <td className="py-4 px-6 text-right">
                      {d.status === "OPENED" || d.status === "EVIDENCE_REQUESTED" ? (
                        <button
                          onClick={() => handleOpenRebuttal(d)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Rebut Claim
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          {d.status === "EVIDENCE_SUBMITTED"
                            ? "Under Review"
                            : "Concluded"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rebuttal Defense Modal */}
      {selectedDispute && (
        <DisputeRebuttalModal
          dispute={selectedDispute}
          vendorId={vendor.id}
          isOpen={isRebuttalModalOpen}
          onClose={() => {
            setIsRebuttalModalOpen(false);
            setSelectedDispute(null);
          }}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}

