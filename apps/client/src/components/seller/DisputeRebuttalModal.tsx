"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  X,
  Loader2,
  FileText,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { DisputeResponse } from "@repo/types";
import { submitSellerRebuttal } from "@/services/dispute.service";

interface DisputeRebuttalModalProps {
  dispute: DisputeResponse;
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DisputeRebuttalModal({
  dispute,
  vendorId,
  isOpen,
  onClose,
  onSuccess,
}: DisputeRebuttalModalProps): React.JSX.Element | null {
  const { getToken } = useAuth();

  const [rebuttal, setRebuttal] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    try {
      new URL(newUrl);
      setEvidenceUrls([...evidenceUrls, newUrl.trim()]);
      setNewUrl("");
    } catch {
      toast.error(
        "Please enter a valid URL (e.g. proof of delivery, tracking PDF, inspection log).",
      );
    }
  };

  const handleRemoveUrl = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rebuttal.trim().length < 10) {
      toast.warn(
        "Please provide at least 10 characters detailing your rebuttal defense.",
      );
      return;
    }
    if (evidenceUrls.length === 0) {
      toast.warn("At least 1 supporting document or tracking URL is required.");
      return;
    }

    try {
      setSubmitting(true);
      const token = (await getToken()) || undefined;

      await submitSellerRebuttal(
        vendorId,
        dispute.id,
        {
          sellerRebuttal: rebuttal.trim(),
          sellerEvidenceUrls: evidenceUrls,
        },
        token,
      );

      toast.success(
        "Rebuttal defense submitted successfully! Claim transitioned to Arbitration.",
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit rebuttal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Seller Rebuttal Defense
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dispute #{dispute.disputeNumber} • Order #{dispute.orderId}
            </p>
          </div>
        </div>

        {/* Buyer Claim Review Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Customer Claim Reason:</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 uppercase">
              {dispute.type.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
            &ldquo;{dispute.buyerClaim}&rdquo;
          </p>

          {dispute.buyerEvidenceUrls.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Customer Evidence Files:
              </span>
              <div className="flex flex-wrap gap-2">
                {dispute.buyerEvidenceUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:text-indigo-600"
                  >
                    <span>Evidence #{i + 1}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Rebuttal Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Merchant Counter-Defense Explanation *
            </label>
            <textarea
              required
              rows={4}
              value={rebuttal}
              onChange={(e) => setRebuttal(e.target.value)}
              placeholder="Provide courier tracking details, signature proof, package weight receipts, or warehouse dispatch verification..."
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 10 characters.
            </p>
          </div>

          {/* Evidence Upload URLs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Merchant Counter-Evidence URLs (Proof of Delivery, Inspection) *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://tcs.com.pk/tracking/receipt.pdf"
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {evidenceUrls.length > 0 ? (
              <ul className="space-y-1.5">
                {evidenceUrls.map((url, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <span className="truncate max-w-[85%]">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                At least one counter-evidence link is required to rebut this
                dispute.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || evidenceUrls.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting Rebuttal...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Submit Formal Rebuttal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
