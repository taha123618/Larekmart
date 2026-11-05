"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  LifeBuoy,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Paperclip,
} from "lucide-react";
import type {
  Ticket,
  TicketCategory,
  TicketPriority,
  MediaAttachment,
} from "@repo/types";
import {
  createSupportTicket,
  fetchSupportCategories,
} from "@/services/support.service";

interface OpenSupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticket: Ticket) => void;
  initialOrderId?: string;
  initialReturnId?: string;
  initialCategoryCode?: string;
  initialSubject?: string;
}

const FALLBACK_CATEGORIES = [
  { code: "ORDER_INQUIRY", name: "Order Inquiry & Tracking" },
  { code: "PAYMENT_ISSUE", name: "Payment & Billing" },
  { code: "RETURN_REFUND", name: "Return & Refund Request" },
  { code: "PRODUCT_QUESTION", name: "Product Inquiry & Inventory" },
  { code: "SHIPPING_DELIVERY", name: "Shipping & Courier Delays" },
  { code: "SELLER_DISPUTE", name: "Seller & Store Dispute" },
  { code: "ACCOUNT_SECURITY", name: "Account & Login Security" },
  { code: "TECHNICAL_BUG", name: "Website or App Glitch" },
];

export default function OpenSupportTicketModal({
  isOpen,
  onClose,
  onSuccess,
  initialOrderId,
  initialReturnId,
  initialCategoryCode = "ORDER_INQUIRY",
  initialSubject = "",
}: OpenSupportTicketModalProps): React.JSX.Element | null {
  const { getToken } = useAuth();

  const [categories, setCategories] =
    useState<Array<{ code: string; name: string }>>(FALLBACK_CATEGORIES);
  const [categoryCode, setCategoryCode] = useState(initialCategoryCode);
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [subject, setSubject] = useState(initialSubject);
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState(initialOrderId || "");
  const [returnId, setReturnId] = useState(initialReturnId || "");

  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialOrderId) setOrderId(initialOrderId);
    if (initialReturnId) setReturnId(initialReturnId);
    if (initialSubject) setSubject(initialSubject);
    if (initialCategoryCode) setCategoryCode(initialCategoryCode);
  }, [initialOrderId, initialReturnId, initialSubject, initialCategoryCode]);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const token = await getToken();
        const cats = await fetchSupportCategories(token);
        if (isMounted && cats.length > 0) {
          setCategories(
            cats.map((c: TicketCategory) => ({ code: c.code, name: c.name })),
          );
        }
      } catch {
        // Fallback already pre-populated
      }
    }
    if (isOpen) {
      loadCategories();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, getToken]);

  if (!isOpen) return null;

  const handleAddAttachment = () => {
    if (!attachmentUrl.trim()) return;
    try {
      new URL(attachmentUrl);
      const fileName =
        attachmentUrl.split("/").pop()?.split("?")[0] || "attachment";
      const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
      setAttachments([
        ...attachments,
        {
          url: attachmentUrl.trim(),
          name: fileName,
          mimeType: isImg ? "image/jpeg" : "application/octet-stream",
        },
      ]);
      setAttachmentUrl("");
    } catch {
      toast.error("Please enter a valid URL (e.g. image or document link).");
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || subject.trim().length < 3) {
      toast.error("Subject must be at least 3 characters.");
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      toast.error(
        "Please describe your inquiry or issue in at least 10 characters.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken();

      const created = await createSupportTicket(
        {
          subject: subject.trim(),
          description: description.trim(),
          categoryCode,
          priority,
          orderId: orderId.trim() || undefined,
          returnId: returnId.trim() || undefined,
          attachments,
        },
        token,
      );

      toast.success(
        `Support ticket #${created.ticketNumber} created successfully! Our team will respond shortly.`,
      );
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to open support ticket";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Contact Customer Support
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submit an inquiry or report an issue directly to our support
                agents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urgency / Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="LOW">Low — General inquiry</option>
                <option value="MEDIUM">Medium — Standard assistance</option>
                <option value="HIGH">High — Order issue / delay</option>
                <option value="URGENT">
                  Urgent — Critical billing or defect
                </option>
              </select>
            </div>
          </div>

          {/* Reference Order ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Order ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 660e8400-e29b-41d4-a716-446655440000"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject *
            </label>
            <input
              type="text"
              required
              placeholder="Brief summary of your question or issue..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Please provide details, error messages, or context to help our agents assist you quickly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Attachments (Images / Screenshots URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/screenshot.png"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="flex-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-sm">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {att.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Support tickets are assigned in real-time according to priority
              SLAs. You will receive updates directly on your dashboard and via
              email.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-2 transition disabled:opacity-50 shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <LifeBuoy className="w-4 h-4" />
                  Submit Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
