"use client";

import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import type { OrderType } from "@repo/types";
import LiveChatDrawer from "./LiveChatDrawer";

interface OrderChatActionProps {
  order: OrderType;
}

export default function OrderChatAction({
  order,
}: OrderChatActionProps): React.JSX.Element {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const orderId = order._id || (order as { id?: string }).id || "";
  const sellerId =
    (order as any).sellerId ||
    (order as any).vendorId ||
    (order.products && order.products[0] && (order.products[0] as any).sellerId) ||
    "seller_default";

  return (
    <>
      <button
        onClick={() => setIsChatOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer"
        title="Chat with Seller regarding this order"
      >
        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Chat</span>
      </button>

      <LiveChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialType="DIRECT_BUYER_SELLER"
        initialOrderId={orderId}
        initialSellerId={sellerId}
        title={orderId ? `Order #${orderId.slice(0, 8)} Inquiry` : "Order Inquiry"}
      />
    </>
  );
}
