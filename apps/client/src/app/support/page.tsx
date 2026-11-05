"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  LifeBuoy,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Loader2,
  Paperclip,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Package,
  Truck,
  RotateCcw,
  CreditCard,
  User,
  Headphones,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  Ticket,
  TicketMessage,
  TicketStatus,
  MediaAttachment,
} from "@repo/types";
import {
  fetchMyTickets,
  fetchMyTicketById,
  addTicketReply,
} from "@/services/support.service";
import OpenSupportTicketModal from "@/components/support/OpenSupportTicketModal";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  OPEN: {
    label: "Open",
    bg: "bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    icon: RefreshCw,
  },
  WAITING_ON_CUSTOMER: {
    label: "Action Required",
    bg: "bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-300",
    icon: AlertCircle,
  },
  WAITING_ON_AGENT: {
    label: "Agent Review",
    bg: "bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800",
    text: "text-sky-800 dark:text-sky-300",
    icon: Headphones,
  },
  ESCALATED: {
    label: "Escalated",
    bg: "bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800",
    text: "text-rose-800 dark:text-rose-300",
    icon: ShieldAlert,
  },
  RESOLVED: {
    label: "Resolved",
    bg: "bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    bg: "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    icon: CheckCircle2,
  },
};

const DEFAULT_STATUS_META = {
  label: "Open",
  bg: "bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800",
  text: "text-amber-800 dark:text-amber-300",
  icon: Clock,
};

const DEFAULT_PRIORITY_META = {
  label: "Medium",
  badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
};

const PRIORITY_BADGES: Record<string, { label: string; badge: string }> = {
  LOW: {
    label: "Low",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  HIGH: {
    label: "High",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  CRITICAL: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  URGENT: {
    label: "Urgent",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

const FAQ_ITEMS = [
  {
    q: "How fast will support respond to my ticket?",
    a: "Every ticket is bound by our automated SLA policy. Standard tickets receive initial agent review within 15 to 30 minutes during active hours.",
  },
  {
    q: "How do I report a missing or damaged item?",
    a: "You can click 'Support' directly on any order in your My Orders dashboard, or click 'Open New Ticket' here and select 'Order Inquiry' or 'Return & Refund'.",
  },
  {
    q: "Can I track my shipment directly?",
    a: "Yes! Head to our Track Orders page to see real-time courier checkpoints, milestones, and estimated delivery dates.",
    link: "/track",
    linkText: "Track Orders",
  },
  {
    q: "How do refunds and returns work?",
    a: "Returns are governed by our Automated Return System. Once authorized, you will receive a courier tracking label to return your item.",
    link: "/account/returns",
    linkText: "Returns Portal",
  },
];

export default function SupportPage(): React.JSX.Element {
  const { getToken, isSignedIn } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected ticket for conversation timeline modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<MediaAttachment[]>(
    [],
  );
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetchMyTickets(
        {
          status:
            statusFilter === "ALL" ? undefined : (statusFilter as TicketStatus),
          search: searchQuery.trim() || undefined,
          limit: 30,
        },
        token,
      );
      setTickets(res.items);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load support tickets";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, statusFilter, searchQuery]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleOpenDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    try {
      setLoadingDetail(true);
      const token = await getToken();
      const detailed = await fetchMyTicketById(ticket.id, token);
      setSelectedTicket(detailed);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load ticket details";
      toast.error(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddReplyAttachment = () => {
    if (!replyAttachmentUrl.trim()) return;
    try {
      new URL(replyAttachmentUrl);
      const fileName =
        replyAttachmentUrl.split("/").pop()?.split("?")[0] || "attachment";
      const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
      setReplyAttachments([
        ...replyAttachments,
        {
          url: replyAttachmentUrl.trim(),
          name: fileName,
          mimeType: isImg ? "image/jpeg" : "application/octet-stream",
        },
      ]);
      setReplyAttachmentUrl("");
    } catch {
      toast.error("Please enter a valid URL.");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const token = await getToken();
      await addTicketReply(
        selectedTicket.id,
        {
          content: replyText.trim(),
          isInternalNote: false,
          attachments: replyAttachments,
        },
        token,
      );

      toast.success("Reply submitted to support team!");
      setReplyText("");
      setReplyAttachments([]);

      // Refresh ticket details
      const updated = await fetchMyTicketById(selectedTicket.id, token);
      setSelectedTicket(updated);
      loadTickets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reply";
      toast.error(msg);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* HERO SECTION */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-sky-600 via-indigo-600 to-purple-700 p-8 sm:p-12 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold">
              <LifeBuoy className="w-3.5 h-3.5 text-sky-200" />
              <span>Larekmart Customer Help & SLA Resolution Center</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              How can we assist you today?
            </h1>
            <p className="text-sm sm:text-base text-sky-100">
              Get immediate assistance on orders, logistics, payments, or
              disputes. Our dedicated support team is backed by round-the-clock
              SLAs.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <SignedIn>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold text-sm shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  Open New Support Ticket
                </button>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold text-sm shadow-md transition">
                    <User className="w-4 h-4" />
                    Sign In to View & Open Tickets
                  </button>
                </SignInButton>
              </SignedOut>

              <Link
                href="/track"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-sm transition"
              >
                <Truck className="w-4 h-4" />
                Track Courier
              </Link>
              <Link
                href="/account/returns"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                Returns & Refunds
              </Link>
            </div>
          </div>
        </div>

        {/* QUICK ACTION TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Order Inquiries
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Questions regarding item status, cancellation or seller
                delivery.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Payments & Billing
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Stripe transactions, invoice inquiries, or refund
                reconciliation.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Shipping & Couriers
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                TCS, Leopards, DHL & FedEx tracking and dispatch exceptions.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Buyer Protection
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Escrow protection, counterfeit claims, and seller dispute
                center.
              </p>
            </div>
          </div>
        </div>

        {/* CUSTOMER TICKETS DASHBOARD */}
        <SignedIn>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Header & Controls */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <span>My Support Tickets</span>
                    {totalCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-semibold">
                        {totalCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track the live progress of your inquiries, replies, and
                    resolutions
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  New Ticket
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                  {[
                    "ALL",
                    "OPEN",
                    "IN_PROGRESS",
                    "WAITING_ON_CUSTOMER",
                    "RESOLVED",
                    "CLOSED",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                        statusFilter === s
                          ? "bg-sky-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by ticket # or topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Ticket List Body */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                <p className="text-xs text-slate-500">
                  Loading your support tickets...
                </p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <LifeBuoy className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No support tickets found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {statusFilter !== "ALL" || searchQuery
                    ? "Try clearing filters to see more results."
                    : "You do not have any active or past support inquiries."}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => {
                  const statusMeta =
                    (t.status && STATUS_CONFIG[t.status]) ||
                    DEFAULT_STATUS_META;
                  const StatusIcon = statusMeta.icon;
                  const priorityMeta =
                    (t.priority && PRIORITY_BADGES[t.priority]) ||
                    DEFAULT_PRIORITY_META;

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            #{t.ticketNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusMeta.bg} ${statusMeta.text}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityMeta.badge}`}
                          >
                            {priorityMeta.label} Priority
                          </span>
                          {t.category && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {t.category.name}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {t.subject}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {t.description}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                          <span>
                            Created:{" "}
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                          {t.orderId && (
                            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                              <Package className="w-3 h-3" />
                              Order: {t.orderId.slice(0, 8)}...
                            </span>
                          )}
                          {t.messages && t.messages.length > 0 && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MessageSquare className="w-3 h-3" />
                              {t.messages.length} replies
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition">
                          <span>View Discussion</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SignedIn>

        {/* TICKET DETAILS / TIMELINE MODAL */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      #{selectedTicket.ticketNumber}
                    </span>
                    {(() => {
                      const meta =
                        (selectedTicket.status &&
                          STATUS_CONFIG[selectedTicket.status]) ||
                        DEFAULT_STATUS_META;
                      const Icon = meta.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                      );
                    })()}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      {selectedTicket.priority} Priority
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedTicket.subject}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content / Timeline */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Ticket Overview Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Initial Inquiry Description
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.description}
                  </p>
                  {selectedTicket.orderId && (
                    <div className="text-xs text-sky-600 dark:text-sky-400 pt-1 flex items-center gap-1.5 font-medium">
                      <Package className="w-3.5 h-3.5" />
                      Linked Order: #{selectedTicket.orderId}
                    </div>
                  )}
                </div>

                {/* Timeline Messages */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation History
                  </h3>

                  {loadingDetail ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                      Loading messages...
                    </div>
                  ) : !selectedTicket.messages ||
                    selectedTicket.messages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                      No agent replies yet. Our support engineers are actively
                      reviewing your case.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedTicket.messages.map((msg: TicketMessage) => {
                        const isCustomer = msg.senderRole === "CUSTOMER";
                        return (
                          <div
                            key={msg.id}
                            className={`p-4 rounded-2xl text-xs space-y-2 max-w-[85%] ${
                              isCustomer
                                ? "ml-auto bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-100"
                                : "mr-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500 dark:text-slate-400 border-b border-black/5 dark:border-white/5 pb-1">
                              <span className="font-bold flex items-center gap-1">
                                {isCustomer ? (
                                  <>
                                    <User className="w-3 h-3 text-sky-600" />
                                    You
                                  </>
                                ) : (
                                  <>
                                    <Headphones className="w-3 h-3 text-emerald-600" />
                                    {msg.senderName || "Support Specialist"} (
                                    {msg.senderRole})
                                  </>
                                )}
                              </span>
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>

                            <p className="whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>

                            {msg.mediaAttachments &&
                              msg.mediaAttachments.length > 0 && (
                                <div className="pt-1 flex flex-wrap gap-2">
                                  {msg.mediaAttachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline bg-white/60 dark:bg-black/20 px-2 py-1 rounded-md"
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      {att.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Reply Box Footer */}
              {selectedTicket.status !== "CLOSED" ? (
                <form
                  onSubmit={handleSendReply}
                  className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 space-y-3"
                >
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      placeholder="Type your response to the support team..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition disabled:opacity-50 shrink-0"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Reply</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Attachment input row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Attach screenshot or file URL..."
                      value={replyAttachmentUrl}
                      onChange={(e) => setReplyAttachmentUrl(e.target.value)}
                      className="flex-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddReplyAttachment}
                      className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold rounded-lg hover:bg-slate-300 transition"
                    >
                      Attach
                    </button>
                  </div>

                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {replyAttachments.map((att, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-md"
                        >
                          <Paperclip className="w-3 h-3" />
                          {att.name}
                        </span>
                      ))}
                    </div>
                  )}
                </form>
              ) : (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-center text-xs text-slate-500">
                  This ticket is closed. If you need further assistance, please
                  open a new ticket.
                </div>
              )}
            </div>
          </div>
        )}

        {/* FREQUENTLY ASKED QUESTIONS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Frequently Asked Questions
              </h3>
              <p className="text-xs text-slate-500">
                Instant answers to common customer service questions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2"
              >
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                  {item.q}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.a}
                </p>
                {item.link && (
                  <Link
                    href={item.link}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline pt-1"
                  >
                    <span>{item.linkText}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CREATE TICKET MODAL */}
      <OpenSupportTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadTickets();
        }}
      />
    </div>
  );
}
