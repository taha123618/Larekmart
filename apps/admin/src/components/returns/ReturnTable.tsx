"use client";

import React, { useState } from "react";
import { AdminReturnRecord } from "@/services/return.service";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

interface ReturnTableProps {
  returns: AdminReturnRecord[];
  isLoading?: boolean;
  onViewDetails: (record: AdminReturnRecord) => void;
  onApprove: (returnId: string) => void;
  onReject: (returnId: string) => void;
  onInspect: (returnId: string) => void;
  onRetryRefund: (returnId: string) => void;
}

export function ReturnTable({
  returns,
  isLoading,
  onViewDetails,
  onApprove,
  onReject,
  onInspect,
  onRetryRefund,
}: ReturnTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.sellerId &&
        r.sellerId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REQUESTED":
      case "PENDING_REVIEW":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300";
      case "APPROVED":
      case "AWAITING_RETURN_SHIPMENT":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300";
      case "IN_TRANSIT":
      case "RECEIVED":
        return "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300";
      case "INSPECTION":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300";
      case "REFUND_PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-300";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300";
      case "REJECTED":
      case "CANCELLED":
      case "REFUND_FAILED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search return ID, order, or customer..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="AWAITING_RETURN_SHIPMENT">Awaiting Shipment</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="RECEIVED">Received</option>
            <option value="INSPECTION">Inspection</option>
            <option value="REFUND_PENDING">Refund Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUND_FAILED">Refund Failed</option>
          </select>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Return ID</th>
              <th className="py-3 px-4">Order / Customer</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Refund Amount</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>Loading return operations data...</span>
                  </div>
                </td>
              </tr>
            ) : filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No return requests match the selected filters.
                </td>
              </tr>
            ) : (
              filteredReturns.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition group"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={() => onViewDetails(r)}
                    >
                      #{r.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-slate-900 dark:text-white font-medium">
                      Order: {r.orderId.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Cust: {r.customerId.slice(0, 10)}...
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                        r.status,
                      )}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                    {r.reasonCategory}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                    ${r.totalRefund} {r.currency}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                    {new Date(r.requestedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onViewDetails(r)}
                        title="View Full Details"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(r.status === "REQUESTED" ||
                        r.status === "PENDING_REVIEW") && (
                        <>
                          <button
                            onClick={() => onApprove(r.id)}
                            title="Approve Return"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onReject(r.id)}
                            title="Reject Return"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(r.status === "RECEIVED" ||
                        r.status === "INSPECTION" ||
                        r.status === "AWAITING_RETURN_SHIPMENT") && (
                        <button
                          onClick={() => onInspect(r.id)}
                          title="Record Inspection"
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition cursor-pointer"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                      )}

                      {r.status === "REFUND_FAILED" && (
                        <button
                          onClick={() => onRetryRefund(r.id)}
                          title="Retry Failed Refund SAGA"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
