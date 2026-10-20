"use client";

import React from "react";
import {
  AdminReturnRecord,
} from "@/services/return.service";
import {
  X,
  Package,
  Image as ImageIcon,
  Clock,
  User,
  History,
  ExternalLink,
} from "lucide-react";

interface ReturnDetailsModalProps {
  returnRecord: AdminReturnRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (returnId: string) => void;
  onReject?: (returnId: string) => void;
  onInspect?: (returnId: string) => void;
  onRetryRefund?: (returnId: string) => void;
}

export function ReturnDetailsModal({
  returnRecord,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onInspect,
  onRetryRefund,
}: ReturnDetailsModalProps) {
  if (!isOpen || !returnRecord) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Return Details
              </h2>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                  returnRecord.status,
                )}`}
              >
                {returnRecord.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              ID: {returnRecord.id} • Order #{returnRecord.orderId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Subtotal Refund
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                ${returnRecord.subtotalRefund}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Tax Refund
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                +${returnRecord.taxRefund}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Shipping Deduction
              </span>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                -${returnRecord.shippingDeduction}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Total Refund
              </span>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                ${returnRecord.totalRefund} {returnRecord.currency}
              </p>
            </div>
          </div>

          {/* Customer & Policy Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5" /> Customer Details
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                Customer ID: {returnRecord.customerId}
              </p>
              {returnRecord.sellerId && (
                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono mt-1">
                  Seller ID: {returnRecord.sellerId}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Reason:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {returnRecord.reasonCategory}
                </span>
              </p>
              {returnRecord.customerComments && (
                <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                  &ldquo;{returnRecord.customerComments}&rdquo;
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" /> Policy & Timestamps
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Policy Version:{" "}
                <span className="font-mono font-semibold">
                  {returnRecord.policyVersion}
                </span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Requested:{" "}
                {returnRecord.requestedAt
                  ? new Date(returnRecord.requestedAt).toLocaleString()
                  : "-"}
              </p>
              {returnRecord.approvedAt && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Approved: {new Date(returnRecord.approvedAt).toLocaleString()}
                </p>
              )}
              {returnRecord.completedAt && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Completed:{" "}
                  {new Date(returnRecord.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Returned Items */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-3">
              <Package className="w-3.5 h-3.5" /> Returned Items (
              {returnRecord.items?.length || 0})
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Product ID</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Unit Price</th>
                    <th className="py-2.5 px-3">Discount</th>
                    <th className="py-2.5 px-3">Tax</th>
                    <th className="py-2.5 px-3">Refund Subtotal</th>
                    <th className="py-2.5 px-3">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnRecord.items && returnRecord.items.length > 0 ? (
                    returnRecord.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono text-slate-900 dark:text-white">
                          {item.productId}
                        </td>
                        <td className="py-2 px-3 font-bold">{item.quantity}</td>
                        <td className="py-2 px-3">${item.unitPrice}</td>
                        <td className="py-2 px-3 text-rose-600 dark:text-rose-400">
                          -${item.itemDiscount}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          +${item.proratedTax}
                        </td>
                        <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                          ${item.refundSubtotal}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {item.condition}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        No item breakdown available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Media Evidence */}
          {returnRecord.media && returnRecord.media.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                <ImageIcon className="w-3.5 h-3.5" /> Customer Attached Evidence
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {returnRecord.media.map((m) => (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video bg-slate-100 dark:bg-slate-800 block cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.caption || "Return evidence"}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Audit State Transitions Timeline */}
          {returnRecord.transitions && returnRecord.transitions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                <History className="w-3.5 h-3.5" /> State Transition Audit Trail
              </h3>
              <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 ml-2 pl-4">
                {returnRecord.transitions.map((t) => (
                  <div key={t.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {t.previousState} → {t.newState}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        by {t.actorRole} ({t.actorId})
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(t.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {t.reasonNote && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                        Note: {t.reasonNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Current Status:{" "}
            <span className="font-bold text-slate-800 dark:text-white">
              {returnRecord.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(returnRecord.status === "REQUESTED" ||
              returnRecord.status === "PENDING_REVIEW") && (
              <>
                <button
                  onClick={() => onReject?.(returnRecord.id)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70 transition cursor-pointer"
                >
                  Reject Return
                </button>
                <button
                  onClick={() => onApprove?.(returnRecord.id)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
                >
                  Approve Return
                </button>
              </>
            )}

            {(returnRecord.status === "RECEIVED" ||
              returnRecord.status === "INSPECTION" ||
              returnRecord.status === "AWAITING_RETURN_SHIPMENT") && (
              <button
                onClick={() => onInspect?.(returnRecord.id)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition shadow-xs cursor-pointer"
              >
                Record Inspection
              </button>
            )}

            {returnRecord.status === "REFUND_FAILED" && (
              <button
                onClick={() => onRetryRefund?.(returnRecord.id)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition shadow-xs cursor-pointer"
              >
                Retry Refund SAGA
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
