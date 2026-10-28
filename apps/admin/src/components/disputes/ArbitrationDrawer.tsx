"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  User,
  Building2,
  AlertTriangle,
  History,
} from "lucide-react";
import type { DisputeResponse, ResolveDisputeInput } from "@repo/types";
import { resolveAdminDispute } from "@/services/dispute.service";

interface ArbitrationDrawerProps {
  dispute: DisputeResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ArbitrationDrawer({
  dispute,
  isOpen,
  onClose,
  onSuccess,
}: ArbitrationDrawerProps): React.JSX.Element | null {
  const { getToken } = useAuth();

  const [resolutionReason, setResolutionReason] = useState("");
  const [clawbackEscrow, setClawbackEscrow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isResolved =
    dispute.status === "RESOLVED_BUYER_FAVOR" ||
    dispute.status === "RESOLVED_SELLER_FAVOR" ||
    dispute.status === "CANCELLED";

  const handleResolve = async (resolution: "BUYER_FAVOR" | "SELLER_FAVOR") => {
    if (resolutionReason.trim().length < 5) {
      toast.warn("Please enter a valid resolution rationale (minimum 5 characters).");
      return;
    }

    try {
      setSubmitting(true);
      const token = (await getToken()) || undefined;

      const payload: ResolveDisputeInput = {
        resolution,
        resolutionReason: resolutionReason.trim(),
        clawbackEscrow,
      };

      await resolveAdminDispute(dispute.id, payload, token);
      toast.success(
        resolution === "BUYER_FAVOR"
          ? "Dispute resolved in Buyer's favor. Escrow clawed back."
          : "Dispute resolved in Seller's favor. Escrow funds unfrozen.",
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to resolve dispute",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full flex flex-col p-6 sm:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Arbitration Desk
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {dispute.disputeNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Order #{dispute.orderId} • Claim: {dispute.currency}{" "}
                {dispute.disputedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-6 flex-1">
          {/* Dispute Overview Card */}
          <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block text-[11px]">Buyer Account</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {dispute.buyerEmail || dispute.buyerId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Vendor ID</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {dispute.vendorId.slice(0, 18)}...
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Dispute Category</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {dispute.type.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Dispute Status</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {dispute.status}
              </span>
            </div>
          </div>

          {/* Evidence Comparison Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buyer Claim */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span>Buyer Initial Claim</span>
                  <span className="text-[10px] text-slate-400">Plaintiff</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 italic mb-4 leading-relaxed">
                  &ldquo;{dispute.buyerClaim}&rdquo;
                </p>
              </div>

              {dispute.buyerEvidenceUrls.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                    Customer Evidence Links:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {dispute.buyerEvidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 truncate"
                      >
                        <span className="truncate">{url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seller Rebuttal */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span>Seller Defense Rebuttal</span>
                  <span className="text-[10px] text-slate-400">Defendant</span>
                </div>
                {dispute.sellerRebuttal ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic mb-4 leading-relaxed">
                    &ldquo;{dispute.sellerRebuttal}&rdquo;
                  </p>
                ) : (
                  <div className="p-4 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-xl my-4">
                    <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                    No rebuttal defense submitted yet. Rebuttal deadline:{" "}
                    {dispute.rebuttalDeadline
                      ? new Date(dispute.rebuttalDeadline).toLocaleDateString()
                      : "Pending"}
                  </div>
                )}
              </div>

              {dispute.sellerEvidenceUrls.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                    Seller Proof of Delivery & Documents:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {dispute.sellerEvidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 truncate"
                      >
                        <span className="truncate">{url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit Timeline */}
          {dispute.timeline && dispute.timeline.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Arbitration Audit Timeline</span>
              </div>
              <div className="space-y-3">
                {dispute.timeline.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {entry.notes || `Performed by ${entry.performedBy}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Action Panel (If Not Resolved) */}
          {!isResolved ? (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Official Arbitration Decision
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Resolution Rationale & Official Findings *
                </label>
                <textarea
                  rows={3}
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  placeholder="Summarize evidence review findings, tracking carrier confirmation, or policy violation..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clawbackCheck"
                  checked={clawbackEscrow}
                  onChange={(e) => setClawbackEscrow(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="clawbackCheck" className="text-xs text-slate-600 dark:text-slate-400">
                  Clawback merchant escrow funds immediately upon Buyer Favor ruling
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleResolve("BUYER_FAVOR")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Rule for Buyer (Refund)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleResolve("SELLER_FAVOR")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Rule for Seller (Unfreeze)
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Dispute Concluded
              </span>
              <p className="text-xs text-slate-500">
                Resolution:{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  {dispute.resolution}
                </span>{" "}
                • {dispute.resolutionReason || "Closed by administrator"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

