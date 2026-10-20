"use client";

import React, { useState } from "react";
import { AdminReturnRecord } from "@/services/return.service";
import {
  ReturnItemConditionEnum,
  ReturnInspectionDispositionEnum,
} from "@repo/types";
import { X, ClipboardCheck, AlertCircle } from "lucide-react";

interface InspectionModalProps {
  returnRecord: AdminReturnRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    overallCondition: string;
    items: Array<{
      returnItemId: string;
      receivedCondition: string;
      disposition: string;
      notes?: string;
    }>;
    notes?: string;
  }) => Promise<void>;
}

export function InspectionModal({
  returnRecord,
  isOpen,
  onClose,
  onSubmit,
}: InspectionModalProps) {
  const [overallCondition, setOverallCondition] = useState<string>("DAMAGED");
  const [generalNotes, setGeneralNotes] = useState<string>("");
  const [itemInspections, setItemInspections] = useState<
    Record<
      string,
      {
        receivedCondition: string;
        disposition: string;
        notes: string;
      }
    >
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !returnRecord) return null;

  const handleItemConditionChange = (itemId: string, condition: string) => {
    setItemInspections((prev) => ({
      ...prev,
      [itemId]: {
        receivedCondition: condition,
        disposition:
          prev[itemId]?.disposition ||
          ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
        notes: prev[itemId]?.notes || "",
      },
    }));
  };

  const handleItemDispositionChange = (itemId: string, disposition: string) => {
    setItemInspections((prev) => ({
      ...prev,
      [itemId]: {
        receivedCondition:
          prev[itemId]?.receivedCondition || ReturnItemConditionEnum.UNOPENED,
        disposition,
        notes: prev[itemId]?.notes || "",
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const itemsPayload = (returnRecord.items || []).map((item) => {
        const itemState = itemInspections[item.id] || {
          receivedCondition: ReturnItemConditionEnum.UNOPENED,
          disposition: ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
          notes: "",
        };
        return {
          returnItemId: item.id,
          receivedCondition: itemState.receivedCondition,
          disposition: itemState.disposition,
          notes: itemState.notes || undefined,
        };
      });

      await onSubmit({
        overallCondition,
        items: itemsPayload,
        notes: generalNotes || undefined,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Record Warehouse Inspection
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Return ID: {returnRecord.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Overall Return Condition
            </label>
            <select
              value={overallCondition}
              onChange={(e) => setOverallCondition(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="UNOPENED_PERFECT">Unopened - Pristine / Like New</option>
              <option value="OPEN_BOX_FUNCTIONAL">Open Box - Fully Functional</option>
              <option value="MINOR_WEAR">Minor Cosmetic Wear</option>
              <option value="DEFECTIVE_FUNCTIONAL">Defective - Hardware Failure</option>
              <option value="DAMAGED">Damaged in Transit / By Customer</option>
              <option value="MISSING_PARTS">Missing Critical Parts or Accessories</option>
            </select>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">
              Item Dispositions ({returnRecord.items?.length || 0})
            </h3>
            <div className="space-y-3">
              {(returnRecord.items || []).map((item) => {
                const itemState = itemInspections[item.id] || {
                  receivedCondition: ReturnItemConditionEnum.UNOPENED,
                  disposition: ReturnInspectionDispositionEnum.RESTOCK_SELLABLE,
                  notes: "",
                };

                return (
                  <div
                    key={item.id}
                    className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {item.productId}
                      </span>
                      <span className="text-slate-500">
                        Qty: <strong className="text-slate-900 dark:text-white">{item.quantity}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Received Condition
                        </label>
                        <select
                          value={itemState.receivedCondition}
                          onChange={(e) =>
                            handleItemConditionChange(item.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="UNOPENED">Unopened</option>
                          <option value="OPEN_BOX">Open Box</option>
                          <option value="DEFECTIVE">Defective</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="MISSING_PARTS">Missing Parts</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Disposition
                        </label>
                        <select
                          value={itemState.disposition}
                          onChange={(e) =>
                            handleItemDispositionChange(item.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="RESTOCK_SELLABLE">Restock Sellable</option>
                          <option value="RESTOCK_REFURBISHED">Restock Refurbished</option>
                          <option value="DAMAGED_SCRAP">Damaged Scrap</option>
                          <option value="RETURN_TO_VENDOR">Return to Vendor (RTV)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              General Inspector Notes (Optional)
            </label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="e.g. Package arrived with intact seal; unit tested and operating within nominal parameters."
              rows={3}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
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
              className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Recording..." : "Confirm & Proceed to Refund"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
