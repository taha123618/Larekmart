"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { OrderType, DisputeType } from "@repo/types";
import { createDispute } from "@/services/dispute.service";

type OrderWithMeta = OrderType & {
  vendorId?: string;
  currency?: string;
  id?: string;
};

interface OpenDisputeModalProps {
  order: OrderType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DISPUTE_TYPES: {
  value: DisputeType;
  label: string;
  description: string;
}[] = [
  {
    value: "ITEM_NOT_RECEIVED",
    label: "Item Not Received",
    description:
      "Tracking shows delivered or delivery deadline exceeded with no parcel.",
  },
  {
    value: "DAMAGED_OR_DEFECTIVE",
    label: "Damaged or Defective Item",
    description:
      "Item arrived broken, shattered, or malfunctioning upon unboxing.",
  },
  {
    value: "SIGNIFICANTLY_NOT_AS_DESCRIBED",
    label: "Significantly Not As Described",
    description:
      "Received item differs completely in material, specifications, or model.",
  },
  {
    value: "WRONG_ITEM_SENT",
    label: "Wrong Item Sent",
    description: "Received an entirely different product or brand.",
  },
  {
    value: "UNAUTHORIZED_TRANSACTION",
    label: "Unauthorized Transaction",
    description: "Transaction was not authorized by the account holder.",
  },
];

export default function OpenDisputeModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: OpenDisputeModalProps): React.JSX.Element | null {
  const { getToken } = useAuth();

  const [type, setType] = useState<DisputeType>("ITEM_NOT_RECEIVED");
  const [claim, setClaim] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const orderWithMeta = order as OrderWithMeta;

  // Resolve vendorId or default to platform
  const vendorId =
    orderWithMeta.vendorId ||
    order.products?.[0]?.sellerId ||
    "00000000-0000-0000-0000-000000000000";

  const totalAmount = typeof order.amount === "number" ? order.amount / 100 : 0;

  const handleAddEvidence = () => {
    if (!newEvidenceUrl.trim()) return;
    try {
      new URL(newEvidenceUrl);
      setEvidenceUrls([...evidenceUrls, newEvidenceUrl.trim()]);
      setNewEvidenceUrl("");
    } catch {
      toast.error("Please enter a valid URL for evidence photo or document.");
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claim.trim().length < 10) {
      toast.warn(
        "Please provide at least 10 characters detailing your dispute.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const token = (await getToken()) || undefined;

      await createDispute(
        {
          orderId: order._id || orderWithMeta.id || "unknown",
          vendorId,
          type,
          disputedAmount: totalAmount > 0 ? totalAmount : 1000,
          currency: orderWithMeta.currency || "PKR",
          buyerClaim: claim.trim(),
          buyerEvidenceUrls: evidenceUrls,
        },
        token,
      );

      toast.success(
        "Dispute opened successfully. The seller has been notified to provide rebuttal.",
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open dispute",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Report Issue & Open Dispute
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Order #{order._id || orderWithMeta.id} • Escrow funds will be held
              in freeze
            </p>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            Opening a dispute automatically places the merchant&apos;s
            settlement escrow into a frozen state. The seller receives a 7-day
            window to provide counter-evidence or dispatch replacements.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dispute Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Dispute Category
            </label>
            <div className="space-y-2">
              {DISPUTE_TYPES.map((dt) => (
                <label
                  key={dt.value}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    type === dt.value
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 text-slate-900 dark:text-white font-semibold"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="disputeType"
                    value={dt.value}
                    checked={type === dt.value}
                    onChange={() => setType(dt.value)}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-bold">{dt.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      {dt.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Claim Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Detailed Claim Explanation *
            </label>
            <textarea
              required
              rows={4}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Describe what went wrong with the delivery, item condition, or discrepancy..."
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 10 characters.
            </p>
          </div>

          {/* Evidence URLs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Supporting Photo / Evidence URLs (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={newEvidenceUrl}
                onChange={(e) => setNewEvidenceUrl(e.target.value)}
                placeholder="https://example.com/unboxing_photo.jpg"
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleAddEvidence}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {evidenceUrls.length > 0 && (
              <ul className="space-y-1.5">
                {evidenceUrls.map((url, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <span className="truncate max-w-[85%]">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvidence(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
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
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Filing Claim...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  Submit Dispute Claim
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
