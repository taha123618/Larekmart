"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Send,
  Search,
  RefreshCw,
  Loader2,
  Paperclip,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Store,
  Headphones,
  Ban,
} from "lucide-react";
import type { Conversation, Message, ConversationType } from "@repo/types";
import {
  fetchMyConversations,
  fetchConversationMessages,
  sendMessage,
  markConversationRead,
  reportMessage,
  blockUser,
} from "@/services/chat.service";

export default function AccountChatPage() {
  const { getToken, userId, isSignedIn } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportModalMessageId, setReportModalMessageId] = useState<
    string | null
  >(null);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const typeParam =
        filterType !== "ALL" ? (filterType as ConversationType) : undefined;
      const res = await fetchMyConversations(
        {
          type: typeParam,
          search: searchQuery.trim() || undefined,
          limit: 30,
        },
        token,
      );
      setConversations(res.items);
      if (res.items.length > 0 && !selectedConv) {
        setSelectedConv(res.items[0] || null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, [getToken, filterType, searchQuery, selectedConv]);

  const loadMessages = useCallback(
    async (convId: string, markRead = true) => {
      try {
        setMessagesLoading(true);
        const token = await getToken();
        const res = await fetchConversationMessages(
          convId,
          { limit: 100 },
          token,
        );
        setMessages(res.items);
        if (markRead) {
          await markConversationRead(convId, undefined, token).catch(() => {});
        }
      } catch {
        toast.error("Could not load message history");
      } finally {
        setMessagesLoading(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (isSignedIn) {
      loadConversations();
    }
  }, [isSignedIn, loadConversations]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id, true);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        loadMessages(selectedConv.id, false);
      }, 5000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedConv, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv || sending) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const token = await getToken();
      const newMsg = await sendMessage(
        selectedConv.id,
        {
          content,
          messageType: "TEXT",
        },
        token,
      );
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
      );
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  const handleReport = async () => {
    if (!reportModalMessageId || !reportReason.trim() || isReporting) return;
    setIsReporting(true);
    try {
      const token = await getToken();
      await reportMessage(
        reportModalMessageId,
        { reason: reportReason.trim(), category: "OTHER" },
        token,
      );
      toast.success(
        "Abuse report submitted. Thank you for keeping Larekmart safe.",
      );
      setReportModalMessageId(null);
      setReportReason("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setIsReporting(false);
    }
  };

  const handleBlock = async (targetUserId: string) => {
    if (
      !confirm("Are you sure you want to block this user from messaging you?")
    )
      return;
    try {
      const token = await getToken();
      await blockUser(
        targetUserId,
        { blockedUserId: targetUserId, reason: "User blocked from web inbox" },
        token,
      );
      toast.success("User blocked.");
      loadConversations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Block failed");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SignedIn>
          {/* Breadcrumb & Navigation */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Link href="/account" className="hover:text-emerald-600">
                  Account
                </Link>
                <span>/</span>
                <span className="text-neutral-900 font-medium dark:text-white">
                  Messages
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mt-1">
                Conversations & Live Chat
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadConversations}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Chat Container */}
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:grid-cols-12 min-h-[650px]">
            {/* Conversation Threads Sidebar */}
            <div className="border-r border-neutral-200 dark:border-neutral-800 lg:col-span-4 flex flex-col">
              {/* Search & Tabs */}
              <div className="border-b border-neutral-200 p-3 space-y-2 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-8 pr-3 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div className="flex gap-1">
                  {[
                    { id: "ALL", label: "All" },
                    { id: "DIRECT_BUYER_SELLER", label: "Sellers" },
                    { id: "SUPPORT_TICKET", label: "Support" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterType(tab.id)}
                      className={`flex-1 rounded-lg py-1 text-xs font-medium transition ${
                        filterType === tab.id
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread List */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : conversations?.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 stroke-1" />
                    <p className="text-xs">No active conversations found</p>
                  </div>
                ) : (
                  conversations?.map((conv) => {
                    const isSelected = selectedConv?.id === conv.id;
                    const isSupport = conv.type === "SUPPORT_TICKET";
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConv(conv)}
                        className={`w-full p-3.5 text-left transition flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                          isSelected
                            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-l-4 border-emerald-600"
                            : ""
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isSupport
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}
                        >
                          {isSupport ? (
                            <Headphones className="h-4 w-4" />
                          ) : (
                            <Store className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-neutral-900 truncate dark:text-white">
                              {conv.title ||
                                (isSupport
                                  ? "Support Ticket"
                                  : "Seller Inquiry")}
                            </h4>
                            <span className="text-[10px] text-neutral-400 shrink-0">
                              {conv.lastMessageAt
                                ? new Date(
                                    conv.lastMessageAt,
                                  ).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 truncate mt-0.5 dark:text-neutral-400">
                            {conv.lastMessagePreview || "No messages yet"}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              {conv.type}
                            </span>
                            {conv.orderId && (
                              <span className="text-[9px] text-neutral-400">
                                Order #{conv.orderId.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Thread Main Panel */}
            <div className="lg:col-span-8 flex flex-col h-[650px] bg-neutral-50/30 dark:bg-neutral-950/20">
              {selectedConv ? (
                <>
                  {/* Chat Header */}
                  <div className="border-b border-neutral-200 bg-white px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {selectedConv.title || "Conversation Thread"}
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Type: {selectedConv.type} • ID: {selectedConv.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedConv.sellerId && (
                        <button
                          onClick={() => handleBlock(selectedConv.sellerId!)}
                          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Block User"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Block</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                    {messagesLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400">
                        <MessageSquare className="h-10 w-10 stroke-1 mb-2" />
                        <p className="text-sm font-medium">
                          No messages in this conversation yet
                        </p>
                        <p className="text-xs text-neutral-500">
                          Type a message below to start communicating.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMine = msg.senderId === userId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`group relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                                isMine
                                  ? "bg-emerald-600 text-white rounded-br-none"
                                  : "bg-white text-neutral-900 dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-bl-none"
                              }`}
                            >
                              {!isMine && (
                                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                  {msg.senderRole}
                                </span>
                              )}
                              <p className="whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>

                              {msg.attachments &&
                                msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.attachments.map(
                                      (att: {
                                        id?: string;
                                        mediaFileId?: string;
                                        fileUrl: string;
                                        fileName?: string;
                                      }) => (
                                        <a
                                          key={att.id || att.mediaFileId}
                                          href={att.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 text-xs underline opacity-90 hover:opacity-100"
                                        >
                                          <Paperclip className="h-3 w-3" />
                                          {att.fileName}
                                        </a>
                                      ),
                                    )}
                                  </div>
                                )}

                              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                                {isMine && <CheckCheck className="h-3 w-3" />}
                              </div>

                              {!isMine && (
                                <button
                                  onClick={() =>
                                    setReportModalMessageId(msg.id)
                                  }
                                  className="absolute -right-7 top-2 hidden text-neutral-400 hover:text-red-500 group-hover:block"
                                  title="Report message"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Send Message Box */}
                  <form
                    onSubmit={handleSendMessage}
                    className="border-t border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Write a message..."
                        disabled={sending}
                        className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim() || sending}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400 p-8">
                  <MessageSquare className="h-12 w-12 stroke-1 mb-2" />
                  <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
                    Select a conversation
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    Choose a thread from the left sidebar to read your
                    buyer-to-seller interactions or customer support updates.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Abuse Report Modal */}
          {reportModalMessageId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-semibold text-base">
                    Report Abusive Message
                  </h3>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
                  Please provide details about this policy violation. Our trust
                  and safety team reviews all reports.
                </p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe the issue (harassment, off-platform payment solicitations, spam)..."
                  rows={4}
                  className="w-full rounded-xl border border-neutral-300 p-3 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white focus:outline-none focus:border-red-500 mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReportModalMessageId(null);
                      setReportReason("");
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={!reportReason.trim() || isReporting}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isReporting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </SignedIn>

        <SignedOut>
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <MessageSquare className="mx-auto h-12 w-12 text-neutral-400" />
            <h2 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
              Sign In to View Messages
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              You must be signed in to communicate with sellers or live support
              agents.
            </p>
            <div className="mt-6">
              <SignInButton mode="modal">
                <button className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-emerald-700">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}
