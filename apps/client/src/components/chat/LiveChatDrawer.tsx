"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Send,
  X,
  Loader2,
  ShieldAlert,
  Paperclip,
  CheckCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { Conversation, Message, ConversationType } from "@repo/types";
import {
  fetchMyConversations,
  fetchConversationMessages,
  sendMessage,
  markConversationRead,
  createConversation,
  reportMessage,
} from "@/services/chat.service";

interface LiveChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: ConversationType;
  initialSellerId?: string;
  initialOrderId?: string;
  initialTicketId?: string;
  title?: string;
}

export default function LiveChatDrawer({
  isOpen,
  onClose,
  initialType = "SUPPORT_TICKET",
  initialSellerId,
  initialOrderId,
  initialTicketId,
  title = "Live Chat & Support",
}: LiveChatDrawerProps) {
  const { getToken, userId } = useAuth();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
      const res = await fetchMyConversations(
        {
          type: initialType,
          sellerId: initialSellerId,
          orderId: initialOrderId,
          ticketId: initialTicketId,
          limit: 20,
        },
        token,
      );

      if (res.items.length > 0 && !activeConv) {
        setActiveConv(res.items[0] || null);
      } else if (
        res.items.length === 0 &&
        (initialSellerId || initialTicketId || initialType === "SUPPORT_TICKET")
      ) {
        // Auto-create or prepare conversation
        try {
          const newConv = await createConversation(
            {
              type: initialType,
              title: title,
              sellerId: initialSellerId,
              orderId: initialOrderId,
              ticketId: initialTicketId,
              initialMessage: "Hello, I would like to get assistance.",
              participantUserIds: [initialSellerId || "support_agent_default"],
            },
            token,
          );
          setActiveConv(newConv);
        } catch {
          // creation failed or already exists
        }
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load chat conversations",
      );
    } finally {
      setLoading(false);
    }
  }, [
    getToken,
    initialType,
    initialSellerId,
    initialOrderId,
    initialTicketId,
    title,
    activeConv,
  ]);

  const loadMessages = useCallback(
    async (convId: string, markRead = true) => {
      try {
        const token = await getToken();
        const res = await fetchConversationMessages(
          convId,
          { limit: 50 },
          token,
        );
        setMessages(res.items);
        if (markRead) {
          await markConversationRead(convId, undefined, token).catch(() => {});
        }
      } catch {
        // quiet poll fail
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [isOpen, loadConversations]);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id, true);

      // Setup 4s polling for incoming live messages
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        loadMessages(activeConv.id, false);
      }, 4000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeConv, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const token = await getToken();
      const newMsg = await sendMessage(
        activeConv.id,
        {
          content: text,
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
      setInputText(text);
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
      toast.success("Message reported to moderators for safety review");
      setReportModalMessageId(null);
      setReportReason("");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to report message",
      );
    } finally {
      setIsReporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeConv
                  ? activeConv.title || "Active Conversation"
                  : "Connecting..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => activeConv && loadMessages(activeConv.id, true)}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/40">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400">
              <MessageSquare className="h-10 w-10 stroke-1 mb-2" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs text-neutral-500">
                Send a message below to start the conversation.
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
                    className={`group relative max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-xs ${
                      isMine
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-bl-none"
                    }`}
                  >
                    {!isMine && (
                      <span className="mb-0.5 block text-[10px] font-medium text-neutral-400">
                        {msg.senderRole}
                      </span>
                    )}
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
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

                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isMine && <CheckCheck className="h-3 w-3" />}
                    </div>

                    {!isMine && (
                      <button
                        onClick={() => setReportModalMessageId(msg.id)}
                        className="absolute -right-6 top-2 hidden text-neutral-400 hover:text-red-500 group-hover:block"
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

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
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

        {/* Moderation / Abuse Report Modal */}
        {reportModalMessageId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-neutral-800">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="font-semibold text-sm">Report Message</h4>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                Please specify why this message violates marketplace standards
                (spam, harassment, fraud):
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason for report..."
                className="w-full rounded-lg border border-neutral-300 p-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-red-500 mb-3"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportModalMessageId(null);
                    setReportReason("");
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={!reportReason.trim() || isReporting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isReporting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
