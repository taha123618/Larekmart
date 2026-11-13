"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Send,
  Search,
  RefreshCw,
  Loader2,
  Paperclip,
  Store,
  Headphones,
  Ban,
} from "lucide-react";
import type {
  Conversation,
  Message,
  ConversationType,
  ChatAttachment,
} from "@repo/types";
import {
  fetchAdminConversations,
  fetchAdminConversationMessages,
  sendAdminMessage,
  blockAbusiveUser,
} from "@/services/chat.service";

function AdminChatContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get("ticketId");
  const orderParam = searchParams.get("orderId");
  const sellerParam = searchParams.get("sellerId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [filterType, setFilterType] = useState<string>(
    ticketParam ? "CUSTOMER_TO_SUPPORT" : "ALL",
  );
  const [searchQuery, setSearchQuery] = useState(
    ticketParam || orderParam || sellerParam || "",
  );
  const [blockingUser, setBlockingUser] = useState(false);

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
      const res = await fetchAdminConversations(
        {
          type: typeParam,
          search: searchQuery.trim() || undefined,
          limit: 50,
        },
        token,
      );
      setConversations(res.items);

      if (res.items.length > 0) {
        let match: Conversation | undefined;
        if (ticketParam) {
          match = res.items.find(
            (c) =>
              (c.metadata as Record<string, unknown> | null)?.ticketId ===
              ticketParam || c.id === ticketParam,
          );
        } else if (orderParam) {
          match = res.items.find(
            (c) =>
              (c.metadata as Record<string, unknown> | null)?.orderId ===
              orderParam,
          );
        } else if (sellerParam) {
          match = res.items.find(
            (c) =>
              (c.metadata as Record<string, unknown> | null)?.sellerId ===
              sellerParam,
          );
        }

        if (match) {
          setSelectedConv(match);
        } else if (!selectedConv) {
          setSelectedConv(res.items[0] || null);
        }
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load conversations",
      );
    } finally {
      setLoading(false);
    }
  }, [
    getToken,
    filterType,
    searchQuery,
    selectedConv,
    ticketParam,
    orderParam,
    sellerParam,
  ]);

  const loadMessages = useCallback(
    async (convId: string) => {
      try {
        setMessagesLoading(true);
        const token = await getToken();
        const res = await fetchAdminConversationMessages(
          convId,
          { limit: 100 },
          token,
        );
        setMessages(res.items);
      } catch {
        // error handling
      } finally {
        setMessagesLoading(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        loadMessages(selectedConv.id);
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
      const newMsg = await sendAdminMessage(selectedConv.id, content, token);
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send staff response",
      );
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    if (
      !confirm(
        `Are you sure you want to block user ${targetUserId} from platform messaging?`,
      )
    )
      return;
    setBlockingUser(true);
    try {
      const token = await getToken();
      await blockAbusiveUser(
        targetUserId,
        "Staff administrator block for violation of terms",
        token,
      );
      toast.success(`User ${targetUserId} blocked successfully`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to block user");
    } finally {
      setBlockingUser(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Live Chat & Moderation
          </h2>
          <p className="text-muted-foreground text-sm">
            Monitor real-time buyer-seller conversations, assist customers in
            live support, and enforce communications safety.
          </p>
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

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:grid-cols-12 min-h-[700px]">
        {/* Left: Conversation List */}
        <div className="border-r border-neutral-200 dark:border-neutral-800 lg:col-span-4 flex flex-col">
          <div className="border-b border-neutral-200 p-3 space-y-2 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, title, user..."
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-8 pr-3 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
            <div className="flex gap-1">
              {[
                { id: "ALL", label: "All" },
                { id: "DIRECT_BUYER_SELLER", label: "Buyer ↔ Seller" },
                { id: "SUPPORT_TICKET", label: "Support" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`flex-1 rounded-lg py-1 text-xs font-medium transition ${filterType === tab.id
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

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
                    className={`w-full p-3.5 text-left transition flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${isSelected
                        ? "bg-neutral-100 dark:bg-neutral-800/80 border-l-4 border-neutral-900 dark:border-white"
                        : ""
                      }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isSupport
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
                              ? "Customer Support Ticket"
                              : "Buyer Inquiry")}
                        </h4>
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {conv.lastMessageAt
                            ? new Date(conv.lastMessageAt).toLocaleDateString(
                              [],
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5 dark:text-neutral-400">
                        {conv.lastMessagePreview || "No messages yet"}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {conv.type}
                        </span>
                        {conv.ticketId && (
                          <span className="text-[9px] text-blue-600 dark:text-blue-400">
                            Ticket #{conv.ticketId.slice(0, 8)}
                          </span>
                        )}
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

        {/* Right: Messages Transcript & Staff Intervention */}
        <div className="lg:col-span-8 flex flex-col h-[700px] bg-neutral-50/30 dark:bg-neutral-950/20">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="border-b border-neutral-200 bg-white px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    {selectedConv.title || "Conversation Transcript"}
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold dark:bg-emerald-950 dark:text-emerald-300">
                      {selectedConv.status}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    ID: {selectedConv.id} • Created:{" "}
                    {new Date(selectedConv.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConv.sellerId && (
                    <button
                      onClick={() => handleBlockUser(selectedConv.sellerId!)}
                      disabled={blockingUser}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900"
                      title="Block Seller"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Block Seller
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Transcript */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400">
                    <MessageSquare className="h-10 w-10 stroke-1 mb-2" />
                    <p className="text-sm font-medium">
                      No messages recorded in this conversation
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.senderRole === "ADMIN";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`group relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${isAdmin
                              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-br-none"
                              : "bg-white text-neutral-900 dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-bl-none"
                            }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] opacity-75 font-medium">
                            <span>
                              {msg.senderRole} ({msg.senderId.slice(0, 10)})
                            </span>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((att: ChatAttachment) => (
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
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Staff Reply Form */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Intervene as Staff / Administrator..."
                    disabled={sending}
                    className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
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
                Choose a conversation from the left queue to review transcript
                history, moderate messages, or intervene as staff.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
        </div>
      }
    >
      <AdminChatContent />
    </Suspense>
  );
}
