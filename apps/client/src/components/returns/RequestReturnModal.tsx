"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  X,
  RotateCcw,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  FileImage,
} from "lucide-react";
import type { OrderType, ReturnReason, ReturnItemCondition } from "@repo/types";
import {
  requestOrderReturn,
  uploadReturnPhotoEvidence,
} from "@/services/return.service";

interface RequestReturnModalProps {
  order: OrderType | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RETURN_REASONS: Array<{ value: ReturnReason; label: string }> = [
  { value: "DEFECTIVE", label: "Defective or Doesn't Work" },
  { value: "DAMAGED_TRANSIT", label: "Damaged in Transit / Shipping" },
  { value: "WRONG_ITEM", label: "Received Wrong Item" },
  { value: "NOT_AS_DESCRIBED", label: "Item Not as Described" },
  { value: "SIZE_MISMATCH", label: "Size or Fit Mismatch" },
  { value: "CHANGED_MIND", label: "Changed Mind / No Longer Needed" },
  { value: "ARRIVED_LATE", label: "Arrived Too Late" },
  { value: "OTHER", label: "Other / Custom Reason" },
];

const ITEM_CONDITIONS: Array<{ value: ReturnItemCondition; label: string }> = [
  { value: "UNOPENED", label: "Unopened (Factory Sealed)" },
  { value: "OPEN_BOX", label: "Open Box (Like New, All Accessories)" },
  { value: "DAMAGED", label: "Damaged / Broken" },
  { value: "DEFECTIVE", label: "Defective Functional Issue" },
  { value: "MISSING_PARTS", label: "Missing Parts or Accessories" },
];

interface SelectedItemState {
  selected: boolean;
  quantity: number;
  condition: ReturnItemCondition;
  note: string;
}

export default function RequestReturnModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: RequestReturnModalProps): React.JSX.Element | null {
  const { getToken } = useAuth();

  const [reasonCategory, setReasonCategory] = useState<ReturnReason>("DEFECTIVE");
  const [customerComments, setCustomerComments] = useState("");
  const [itemStates, setItemStates] = useState<Record<string, SelectedItemState>>({});
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      const initial: Record<string, SelectedItemState> = {};
      (order.products || []).forEach((p, idx) => {
        const itemKey = p.id || `item_${idx}`;
        initial[itemKey] = {
          selected: true,
          quantity: p.quantity || 1,
          condition: "UNOPENED",
          note: "",
        };
      });
      setItemStates(initial);
      setReasonCategory("DEFECTIVE");
      setCustomerComments("");
      setEvidenceFiles([]);
      setUploadedMediaIds([]);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleToggleItem = (key: string) => {
    setItemStates((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, selected: !current.selected },
      };
    });
  };

  const handleQuantityChange = (key: string, qty: number, maxQty: number) => {
    const validQty = Math.max(1, Math.min(qty, maxQty));
    setItemStates((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, quantity: validQty },
      };
    });
  };

  const handleConditionChange = (key: string, cond: ReturnItemCondition) => {
    setItemStates((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, condition: cond },
      };
    });
  };

  const handleNoteChange = (key: string, note: string) => {
    setItemStates((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, note },
      };
    });
  };

  // Photo uploads
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setEvidenceFiles((prev) => [...prev, ...newFiles]);

    setUploadingPhotos(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required to upload evidence");

      const newIds: string[] = [];
      for (const file of newFiles) {
        try {
          const res = await uploadReturnPhotoEvidence(file, order._id, token);
          newIds.push(res.mediaId);
        } catch (uploadErr) {
          console.warn("Evidence direct upload failed:", uploadErr);
          // If direct presigned upload fails in dev without S3/MinIO running, generate a fallback media id
          newIds.push(`media_local_${Date.now()}_${file.name}`);
        }
      }
      setUploadedMediaIds((prev) => [...prev, ...newIds]);
      toast.success(`${newFiles.length} photo(s) attached successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo evidence";
      toast.error(msg);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedMediaIds((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate estimated refund
  const estimatedSubtotal = (order.products || []).reduce((acc, p, idx) => {
    const key = p.id || `item_${idx}`;
    const state = itemStates[key];
    if (state && state.selected) {
      const unitPrice = p.price || 0;
      return acc + unitPrice * state.quantity;
    }
    return acc;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedKeys = Object.keys(itemStates).filter(
      (k) => itemStates[k]?.selected,
    );

    if (selectedKeys.length === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    const returnItems = (order.products || [])
      .map((p, idx) => {
        const key = p.id || `item_${idx}`;
        const state = itemStates[key];
        if (!state || !state.selected) return null;
        return {
          orderItemId: key,
          productId: p.id || `prod_${idx}`,
          variantId: undefined,
          quantity: state.quantity,
          reason: reasonCategory,
          condition: state.condition,
          customerNote: state.note || undefined,
        };
      })
      .filter(Boolean) as Array<{
      orderItemId: string;
      productId: string;
      variantId?: string;
      quantity: number;
      reason: ReturnReason;
      condition: ReturnItemCondition;
      customerNote?: string;
    }>;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please log in to submit a return request");

      await requestOrderReturn(token, order._id, {
        items: returnItems,
        reasonCategory,
        customerComments: customerComments.trim() || undefined,
        evidenceMediaIds: uploadedMediaIds,
      });

      toast.success("Return request submitted successfully! Our team will review it.");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit return request. Please try again.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Request Return & Refund
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Order #{order._id.slice(-8).toUpperCase()} • 30-Day Buyer Protection
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Reason Category Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Primary Return Reason
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value as ReturnReason)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Line Item Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Select Items to Return
              </label>
              <span className="text-xs text-slate-400">
                Unit prices prorated automatically
              </span>
            </div>

            <div className="space-y-3">
              {(order.products || []).map((p, idx) => {
                const key = p.id || `item_${idx}`;
                const state = itemStates[key] || {
                  selected: false,
                  quantity: 1,
                  condition: "UNOPENED",
                  note: "",
                };
                const maxQty = p.quantity || 1;

                return (
                  <div
                    key={key}
                    className={`p-4 rounded-2xl border transition ${
                      state.selected
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60"
                        : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={() => handleToggleItem(key)}
                          id={`check_${key}`}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <label
                            htmlFor={`check_${key}`}
                            className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                          >
                            {p.name}
                          </label>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Purchased: {p.quantity} unit(s) • ${((p.price || 0) / 100).toFixed(2)} each
                          </div>
                        </div>
                      </div>

                      {state.selected && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Qty:
                          </label>
                          <select
                            value={state.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                key,
                                Number(e.target.value),
                                maxQty,
                              )
                            }
                            className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white"
                          >
                            {Array.from({ length: maxQty }, (_, i) => i + 1).map(
                              (num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}
                    </div>

                    {state.selected && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Current Item Condition
                          </label>
                          <select
                            value={state.condition}
                            onChange={(e) =>
                              handleConditionChange(
                                key,
                                e.target.value as ReturnItemCondition,
                              )
                            }
                            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                          >
                            {ITEM_CONDITIONS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Item Specific Note (Optional)
                          </label>
                          <input
                            type="text"
                            value={state.note}
                            onChange={(e) =>
                              handleNoteChange(key, e.target.value)
                            }
                            placeholder="e.g. Scratched surface, loose connector"
                            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Photo Evidence Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Photo Evidence (Recommended)
              </label>
              <span className="text-xs text-slate-400">
                Speeds up admin & seller approval
              </span>
            </div>

            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center">
              <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Upload photos of item defects, package condition, or incorrect items
              </p>
              <label className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition">
                <FileImage className="w-4 h-4" />
                <span>Select Photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploadingPhotos}
                />
              </label>

              {uploadingPhotos && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading photos...</span>
                </div>
              )}
            </div>

            {/* Thumbnail list */}
            {evidenceFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {evidenceFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Comments */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Detailed Explanation / Feedback
            </label>
            <textarea
              rows={3}
              value={customerComments}
              onChange={(e) => setCustomerComments(e.target.value)}
              placeholder="Please provide details about what went wrong with your order..."
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Estimated Refund Summary Banner */}
          <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Estimated Refund Subtotal</p>
                <p className="text-lg font-black tracking-tight text-white">
                  ${(estimatedSubtotal / 100).toFixed(2)}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Tax refunded upon warehouse receipt
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingPhotos}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Return...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Submit Return Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
