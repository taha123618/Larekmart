"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  RotateCcw,
  Package,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Loader2,
  DollarSign,
  Download,
} from "lucide-react";
import {
  fetchMyReturns,
  cancelReturnRequest,
  submitReturnTracking,
  type CustomerReturnRecord,
} from "@/services/return.service";

const STATUS_BADGES: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  REQUESTED: {
    label: "Under Review",
    bg: "bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    icon: Clock,
  },
  PENDING_REVIEW: {
    label: "Under Review",
    bg: "bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Return Approved",
    bg: "bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    icon: CheckCircle2,
  },
  AWAITING_RETURN_SHIPMENT: {
    label: "Awaiting Shipment",
    bg: "bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800",
    text: "text-indigo-800 dark:text-indigo-300",
    icon: Truck,
  },
  IN_TRANSIT: {
    label: "In Transit to Warehouse",
    bg: "bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-300",
    icon: Truck,
  },
  RECEIVED: {
    label: "Received at Warehouse",
    bg: "bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800",
    text: "text-cyan-800 dark:text-cyan-300",
    icon: Package,
  },
  INSPECTION: {
    label: "Quality Inspection",
    bg: "bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-300",
    icon: Clock,
  },
  REFUND_PENDING: {
    label: "Refund Processing",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: DollarSign,
  },
  COMPLETED: {
    label: "Refund Completed",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Return Rejected",
    bg: "bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800",
    text: "text-rose-800 dark:text-rose-300",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled by Customer",
    bg: "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-400",
    icon: XCircle,
  },
  REFUND_FAILED: {
    label: "Refund Failed (Retrying)",
    bg: "bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800",
    text: "text-rose-800 dark:text-rose-300",
    icon: AlertCircle,
  },
};

export default function CustomerReturnsPage(): React.JSX.Element {
  const { getToken } = useAuth();

  const [returns, setReturns] = useState<CustomerReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);

  // Tracking submission form state
  const [trackingReturnId, setTrackingReturnId] = useState<string | null>(null);
  const [carrierName, setCarrierName] = useState("TCS Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSubmittingTracking, setIsSubmittingTracking] = useState(false);

  // Cancel action state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const data = await fetchMyReturns(token, { limit: 50 });
      setReturns(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load returns";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const handleCancelReturn = async (returnId: string) => {
    if (!window.confirm("Are you sure you want to cancel this return request?")) {
      return;
    }

    setCancellingId(returnId);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please log in to cancel");
      await cancelReturnRequest(token, returnId, "Cancelled by customer request");
      toast.success("Return request cancelled successfully");
      await loadReturns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel return";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSubmitTracking = async (e: React.FormEvent, returnId: string) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error("Please enter a valid tracking number");
      return;
    }

    setIsSubmittingTracking(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please log in to submit tracking");
      await submitReturnTracking(token, returnId, {
        carrierName,
        trackingNumber: trackingNumber.trim(),
      });
      toast.success("Return shipment tracking details submitted!");
      setTrackingReturnId(null);
      setTrackingNumber("");
      await loadReturns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit tracking";
      toast.error(msg);
    } finally {
      setIsSubmittingTracking(false);
    }
  };

  // Filter returns
  const filteredReturns = returns.filter((ret) => {
    if (filterStatus === "ALL") return true;
    if (filterStatus === "ACTIVE") {
      return [
        "REQUESTED",
        "PENDING_REVIEW",
        "APPROVED",
        "AWAITING_RETURN_SHIPMENT",
        "IN_TRANSIT",
        "RECEIVED",
        "INSPECTION",
        "REFUND_PENDING",
      ].includes(ret.status);
    }
    if (filterStatus === "COMPLETED") return ret.status === "COMPLETED";
    if (filterStatus === "CANCELLED_OR_REJECTED") {
      return ["CANCELLED", "REJECTED"].includes(ret.status);
    }
    return ret.status === filterStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>My Returns & Refunds</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track return authorization statuses, prepaid labels, carrier tracking, and automated Stripe refunds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
          >
            <Package className="w-4 h-4" />
            <span>View Orders</span>
          </Link>
        </div>
      </div>

      <SignedOut>
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
          <RotateCcw className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Sign in to view your returns
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Manage your RMA return requests and refund statuses.
          </p>
          <SignInButton mode="modal">
            <button className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
          {[
            { label: "All Returns", value: "ALL" },
            { label: "Active", value: "ACTIVE" },
            { label: "Completed Refunds", value: "COMPLETED" },
            { label: "Rejected / Cancelled", value: "CANCELLED_OR_REJECTED" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                filterStatus === tab.value
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20 bg-white/95 dark:bg-slate-900/70 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Loading your returns...
            </p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="text-center py-16 bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <RotateCcw className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              No returns found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {filterStatus === "ALL"
                ? "You haven't requested any returns yet. Items purchased within 30 days are eligible for return."
                : "No returns match your selected filter criteria."}
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              Browse Orders to Return
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReturns.map((ret) => {
              const badge = STATUS_BADGES[ret.status] || {
                label: ret.status,
                bg: "bg-slate-100 text-slate-700",
                text: "text-slate-700",
                icon: AlertCircle,
              };
              const BadgeIcon = badge.icon;
              const isExpanded = expandedReturnId === ret.id;

              return (
                <div
                  key={ret.id}
                  className="bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Return Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          RMA #{ret.id.slice(-8).toUpperCase()}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
                        >
                          <BadgeIcon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Order:{" "}
                          <strong className="text-slate-800 dark:text-slate-200">
                            #{ret.orderId.slice(-8).toUpperCase()}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Requested:{" "}
                          {new Date(ret.requestedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Reason: <span className="capitalize">{ret.reasonCategory.replace(/_/g, " ")}</span>
                        </span>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Est. Refund: ${parseFloat(ret.totalEstimatedRefund || "0").toFixed(2)}
                        </span>
                      </div>

                      {ret.customerComments && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1">
                          &ldquo;{ret.customerComments}&rdquo;
                        </p>
                      )}

                      {ret.rejectionReason && (
                        <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Rejection Reason:</strong> {ret.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 flex-wrap">
                      {/* Prepaid Label Download */}
                      {ret.prepaidLabelUrl && (
                        <a
                          href={ret.prepaidLabelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Prepaid Label</span>
                        </a>
                      )}

                      {/* Submit Tracking Button (if approved / awaiting return shipment) */}
                      {(ret.status === "APPROVED" || ret.status === "AWAITING_RETURN_SHIPMENT") && (
                        <button
                          onClick={() => setTrackingReturnId(ret.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>
                            {ret.returnTrackingNumber ? "Update Tracking" : "Submit Tracking"}
                          </span>
                        </button>
                      )}

                      {/* Cancel Request (only if in REQUESTED state) */}
                      {ret.status === "REQUESTED" && (
                        <button
                          onClick={() => handleCancelReturn(ret.id)}
                          disabled={cancellingId === ret.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}

                      {/* Expand / Details Toggle */}
                      <button
                        onClick={() =>
                          setExpandedReturnId(isExpanded ? null : ret.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <span>{isExpanded ? "Hide Details" : "View Items"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Active Tracking Badge (if submitted) */}
                  {ret.returnTrackingNumber && (
                    <div className="mt-4 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Return Carrier:{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {ret.returnCarrier || "Direct Courier"}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 font-semibold">
                          #{ret.returnTrackingNumber}
                        </span>
                      </div>
                      <Link
                        href={`/track?number=${encodeURIComponent(ret.returnTrackingNumber)}`}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span>Track</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  {/* Tracking Submission Form Modal / Box */}
                  {trackingReturnId === ret.id && (
                    <form
                      onSubmit={(e) => handleSubmitTracking(e, ret.id)}
                      className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-3 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>Submit Return Courier Tracking</span>
                        <button
                          type="button"
                          onClick={() => setTrackingReturnId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Carrier
                          </label>
                          <select
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 font-medium"
                          >
                            <option value="TCS Express">TCS Express</option>
                            <option value="Leopards Courier">Leopards Courier</option>
                            <option value="DHL Express">DHL Express</option>
                            <option value="FedEx">FedEx</option>
                            <option value="Direct Courier">Direct Courier</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Courier Tracking Number
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. TCS123456789"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setTrackingReturnId(null)}
                          className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingTracking}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
                        >
                          {isSubmittingTracking ? "Saving..." : "Confirm Shipment"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Expanded Return Items Details */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Returned Line Items ({ret.items?.length || 0})
                      </h4>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/70 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-3">
                        {(ret.items || []).map((item) => (
                          <div
                            key={item.id}
                            className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-4 text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {item.productName || `Product (${item.productId})`}
                              </p>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                                <span>Condition: <strong className="text-slate-700 dark:text-slate-300">{item.condition}</strong></span>
                                <span>•</span>
                                <span>Qty: <strong className="text-slate-700 dark:text-slate-300">{item.quantity}</strong></span>
                                {item.customerNote && (
                                  <>
                                    <span>•</span>
                                    <span className="italic">&ldquo;{item.customerNote}&rdquo;</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-slate-900 dark:text-white">
                                ${parseFloat(item.refundSubtotal || item.unitPrice || "0").toFixed(2)}
                              </p>
                              {item.inspectionDisposition && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {item.inspectionDisposition}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Refund Breakdown Summary */}
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Refund Subtotal:</span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            ${parseFloat(ret.estimatedRefundSubtotal || "0").toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Prorated Sales Tax:</span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            +${parseFloat(ret.estimatedRefundTax || "0").toFixed(2)}
                          </span>
                        </div>
                        {parseFloat(ret.shippingFeeDeduction || "0") > 0 && (
                          <div className="flex justify-between text-rose-600 dark:text-rose-400">
                            <span>Return Shipping Deduction:</span>
                            <span className="font-medium">
                              -${parseFloat(ret.shippingFeeDeduction).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span>Total Authorized Refund:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ${parseFloat(ret.totalEstimatedRefund || "0").toFixed(2)} {ret.currency}
                          </span>
                        </div>
                      </div>

                      {/* Evidence Photo Thumbnails */}
                      {ret.evidence && ret.evidence.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Attached Photo Evidence
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ret.evidence.map((ev) => (
                              <a
                                key={ev.id}
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:scale-105 transition"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={ev.url}
                                  alt={ev.caption || "Return evidence"}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SignedIn>
    </div>
  );
}
