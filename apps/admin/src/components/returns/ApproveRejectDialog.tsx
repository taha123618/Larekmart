"use client";

import React, { useState } from "react";
import { X, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ApproveRejectDialogProps {
  returnId: string | null;
  mode: "APPROVE" | "REJECT" | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApprove: (returnId: string, providePrepaidLabel: boolean, notes?: string) => Promise<void>;
  onConfirmReject: (returnId: string, reason: string) => Promise<void>;
}

export function ApproveRejectDialog({
  returnId,
  mode,
  isOpen,
  onClose,
  onConfirmApprove,
  onConfirmReject,
}: ApproveRejectDialogProps) {
  const [providePrepaidLabel, setProvidePrepaidLabel] = useState(true);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !returnId || !mode) return null;

  const isApprove = mode === "APPROVE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isApprove) {
        await onConfirmApprove(returnId, providePrepaidLabel, notes || undefined);
      } else {
        if (!rejectionReason.trim()) {
          setError("A rejection reason is required.");
          setIsSubmitting(false);
          return;
        }
        await onConfirmReject(returnId, rejectionReason.trim());
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isApprove ? (
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <CheckCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {isApprove ? "Approve Return Request" : "Reject Return Request"}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Return ID: {returnId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isApprove ? (
            <>
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="prepaid-label"
                  checked={providePrepaidLabel}
                  onChange={(e) => setProvidePrepaidLabel(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="prepaid-label"
                  className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <strong className="block text-slate-900 dark:text-white font-bold">
                    Generate Prepaid Shipping Label
                  </strong>
                  Triggers shipping-service to emit carrier label and email customer return instructions.
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Return authorized within 14-day warranty window."
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason (Mandatory)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Item returned outside of the 14-day policy window, or final-sale category."
                rows={3}
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white transition shadow-xs disabled:opacity-50 cursor-pointer ${
                isApprove
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {isSubmitting
                ? "Processing..."
                : isApprove
                ? "Approve Request"
                : "Reject Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
