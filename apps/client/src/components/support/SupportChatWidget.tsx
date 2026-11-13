"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  LifeBuoy,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { askAiSupportAssistant } from "@/services/support.service";
import type { AiSupportResponse } from "@repo/types";
import OpenSupportTicketModal from "./OpenSupportTicketModal";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  suggestedAction?: AiSupportResponse["suggestedAction"];
  canEscalate?: boolean;
}

const QUICK_SUGGESTIONS = [
  "Where is my order?",
  "How do returns work?",
  "What are shipping times?",
  "Accepted payment methods",
];

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-msg",
      sender: "bot",
      text: "Hi there! 👋 I am your Larekmart AI Assistant. Ask me anything about tracking orders, shipping times, returns, or payment methods!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSendMessage(queryText?: string) {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setIsLoading(true);

    try {
      const response = await askAiSupportAssistant(textToSend);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: response.answer,
        timestamp: new Date(),
        suggestedAction: response.suggestedAction,
        canEscalate: response.canEscalate,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "Sorry, I ran into an issue finding that answer. Would you like to create a support ticket with our care team?",
        timestamp: new Date(),
        canEscalate: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function renderActionButton(action?: AiSupportResponse["suggestedAction"]) {
    switch (action) {
      case "TRACK_ORDER":
        return (
          <Link
            href="/track"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition"
          >
            Track Order
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        );
      case "REQUEST_RETURN":
        return (
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition"
          >
            Go to My Orders for Return
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        );
      case "VIEW_CART":
        return (
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition"
          >
            View Cart
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        );
      case "OPEN_TICKET":
        return (
          <button
            type="button"
            onClick={() => setIsTicketModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Open Support Ticket
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-full shadow-xl shadow-orange-600/30 transition-all duration-300 transform hover:scale-105 active:scale-95"
            aria-label="Open AI Customer Support Chat"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <span className="text-sm font-semibold tracking-wide pr-1">
              Ask Larek AI
            </span>
          </button>
        )}

        {/* Chat Window Panel */}
        {isOpen && (
          <div className="w-[360px] sm:w-[400px] h-[540px] max-h-[85vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
            {/* Header */}
            <div className="px-4 py-3.5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Larek AI Assistant</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <p className="text-[11px] text-white/80">Always Instant</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition"
                  aria-label="Close Chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-sm bg-zinc-50 dark:bg-zinc-950/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.sender === "user"
                        ? "bg-zinc-800 text-white dark:bg-zinc-700"
                        : "bg-orange-600 text-white"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[78%] space-y-2 ${
                      msg.sender === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl ${
                        msg.sender === "user"
                          ? "bg-orange-600 text-white rounded-tr-none"
                          : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/80 shadow-xs rounded-tl-none"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {/* Action buttons / links if available */}
                    {msg.sender === "bot" && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {renderActionButton(msg.suggestedAction)}
                        {msg.canEscalate && msg.suggestedAction !== "OPEN_TICKET" && (
                          <button
                            type="button"
                            onClick={() => setIsTicketModalOpen(true)}
                            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400 transition"
                          >
                            <LifeBuoy className="w-3.5 h-3.5" />
                            Need human agent?
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl rounded-tl-none shadow-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            {messages.length <= 2 && (
              <div className="px-3.5 py-2 bg-zinc-100/70 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-1.5 overflow-x-auto scrollbar-none">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSendMessage(suggestion)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-orange-500 hover:text-orange-600 transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about orders, tracking, returns..."
                className="flex-1 text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3.5 py-2.5 rounded-xl border-none focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-xl bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-700 transition"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Embedded Escalation Ticket Modal */}
      <OpenSupportTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        initialSubject="Assistance Request from AI Assistant"
      />
    </>
  );
}
